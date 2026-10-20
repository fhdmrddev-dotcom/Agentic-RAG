# Phase 284: Library at Scale - Pattern Map

**Mapped:** 2026-10-16 (HEAD `0a7cf54d2`, branch `develop`)
**Files analyzed:** 38 new/modified (backend 17, frontend 21)
**Analogs found:** 35 / 38 (3 have no in-repo precedent: a SQL view, an httpx request recorder over the user client, an IntersectionObserver sentinel inside a scroll region)

Read order for the planner: §File Classification, then the per-file sections for the plan being written,
then §Shared Patterns (they apply to every plan). Line numbers were read at HEAD today; re-grep before
quoting them in a PLAN, because `documents.py` / `LibraryPage.tsx` are G-5-hot.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/207_library_documents_view.sql` | migration | DDL (view + grants + index) | `supabase/migrations/206_retention_hold_hardening.sql` (shape) + `200_filtered_retrieval_document_scope.sql` (CONCURRENTLY index) | role-match (no `CREATE VIEW` exists in any migration) |
| `scripts/full-schema-supplement.sql` | config (grant mirror) | DDL | itself, `:508-522` (expert_installs / message_artifacts blocks) | exact |
| `scripts/apply_migration_207.py` (optional, if the plan applies by script) | utility | file-I/O → DB | `scripts/apply_migration_178.py` + `275-BASELINES.md:270-289` (asyncpg apply + VERIFY) | exact |
| `scripts/seed-scale-284.py` | utility (seed) | batch | `scripts/build-recall-bench.py` (guard, `copy_to_table`, `--teardown`) + `backend/tests/integration/_271_gotrue_users.py` (real users) | role-match |
| `scripts/measure-library-284.py` | utility (measurement) | request-response | `scripts/build-recall-bench.py` `measure_*` + report JSON | partial |
| `backend/app/api/documents.py` — `list_documents` | controller | CRUD read, paged | `backend/app/api/document_governance.py:224-255,345-349` (`count="exact"` + `.range()` + `Query(ge,le)`) | exact |
| `backend/app/api/documents.py` — `GET /{document_id}` (new) | controller | single read | `documents.py:944-985` `_assert_document_visible` (+ `maybe_single`) | exact |
| `backend/app/api/documents.py` — `/chunks` `/tables` `/images` `/versions` | controller | paged read | `documents.py:1092-1150` `get_document_conversation` (`count="exact"` + cap + `truncated`) | exact |
| `backend/app/api/library.py` — `GET /library/summary` | controller | aggregate read | same file `:61-137` `get_index_summary` | exact |
| `backend/app/models/document.py` | model | envelope | same file `:175-184` `ConversationResponse` | exact |
| `backend/app/services/document_view_resolver.py` | service | paged read (two strategies) | itself `:289-412` + Find `_fetch_all` `document_search_service.py:235-257` | exact |
| `backend/app/api/document_views.py` | controller | paged read | `document_governance.py:345-349` `_pagination_params` | role-match |
| `backend/app/services/tools/documents.py:509-528` | service (agent tool) | call site | itself | exact (call-site edit only) |
| `backend/app/services/document_search_service.py` | service | paged read in SQL | itself `:446-455` `structure()` + `:243` first-page read | exact |
| `backend/tests/unit/test_284_route_inventory.py` | test (static fence) | — | `backend/tests/unit/test_283_settings_route_inventory.py` | exact |
| `backend/tests/unit/test_284_request_recorder.py` | test (runtime guard) | — | `backend/tests/unit/test_mcp_egress_hardening.py:185-209` (MockTransport) + `dependencies.py:180-216` (shared httpx seam) | partial |
| `backend/tests/unit/test_284_find_sql.py` | test | — | `backend/tests/unit/test_271_search_core.py:109-269` `FakeQuery`/`FakePostgrest` | exact |
| `backend/tests/integration/test_284_*_live.py` (list, summary, leak, parity) | test (live RLS) | — | `backend/tests/integration/test_2171_index_summary_rls.py` + `_271_gotrue_users.py` | exact |
| `backend/tests/unit/test_261014_list_documents_batches_in.py` | test | — | RETIRED (R-11) | — |
| `docs/public/api/concepts/pagination.md` | docs | — | itself (status `stub`, frontmatter only) | exact |
| `frontend/src/hooks/useLibraryDocuments.ts` (new, D-24 seam) | hook | request-response + event-driven | `frontend/src/hooks/useDocumentFind.ts` + `useDocuments.ts` | exact |
| `frontend/src/hooks/useDocuments.ts` | hook | event-driven (Realtime) | itself `:37-101` | exact |
| `frontend/src/hooks/useDocumentPicker.ts` (new, or reuse `useDocumentFind` directly) | hook | request-response (debounced) | `frontend/src/hooks/useDocumentFind.ts` (has a `debounceMs` param) | exact |
| `frontend/src/lib/api/documents.ts` | api client | request-response | itself `:30-35`, `:194-208`, `:435-447` | exact |
| `frontend/src/lib/api/library.ts` | api client | request-response | itself `:16-21` `getIndexSummary` | exact |
| `frontend/src/lib/api.ts` (barrel) | api client | — | itself `:84` | exact |
| `frontend/src/types/index.ts` | model | — | itself `:739-748` `DocumentSearchResponse` | exact |
| `frontend/src/pages/LibraryPage.tsx` | component (page) | derives → consumes | itself `:310-458`, `:656-697`, `:914-951` | exact |
| `frontend/src/components/library/DocumentsPager.tsx` | component | — | itself (delete `ROW_CAP` arm `:24-25,49-50,79,105-109`) | exact |
| `frontend/src/components/library/LibraryStatTiles.tsx` | component | numbers in | itself VECTORS arm `:97-115` | exact |
| `frontend/src/components/ingestion/FolderDetail.tsx` | component | numbers in | `LibraryStatTiles.tsx` `UNKNOWN` / `…` arms | role-match |
| `frontend/src/components/library/LibraryHeaderBar.tsx` | component | numbers in | itself `:229-243` | exact |
| `frontend/src/components/library/IngestionTab.tsx` | component | numbers + paged lists | itself `:150-183`, `:460-466` (`PaginationControls`) | exact |
| `frontend/src/components/library/ViewsTab.tsx` | component | number in | `LibraryPage.tsx:1069` (`corpusCount`) | exact |
| `frontend/src/components/metadata/DocumentChunksSection.tsx` | component | paged (append on scroll) | itself + `frontend/src/docs/components/TocPill.tsx:31-54` (guarded IntersectionObserver) | partial |
| `frontend/src/components/metadata/DocumentTablesSection.tsx` / `DocumentImagesSection.tsx` / `ingestion/DocumentRow.tsx` `VersionHistoryPanel` | component | bounded read + "N of M" | `frontend/src/components/metadata/DocumentConversationSection.tsx:111-119` | exact |
| `frontend/src/components/relationships/CreateLinkDialog.tsx` + `LinkTargetCombobox.tsx` | component (picker) | debounced server search | `useDocumentFind.ts` + `DocumentsFindBody.tsx:173-233` (states) | role-match |
| `frontend/src/components/library/find/StructurePopovers.tsx` + `FindQuickAdd.tsx` | component | summary lists + server search | itself `:403-434` (`AddedByEditor`), `:627-648` | exact |
| `frontend/src/components/retention/LegalHoldDialog.tsx` | component (picker) | debounced server search | itself `:57-64,128-157` + `useDocumentFind.ts` | role-match |
| `frontend/src/components/metadata/TakeoffSection.tsx` | component | bounded read | itself `:73-103` | exact |
| `frontend/src/test-utils/fakeLibraryApi.ts` (new) | test helper | fixture → fake API | `LegalHolds.test.tsx:89-97` (fixture-evaluating `mockImplementation`) + `test_271_search_core.py` `FakePostgrest` (evaluate the request) + `test-utils/mockReactFlow.ts` (location) | role-match |
| `frontend/src/**/__tests__/libraryListFence.test.ts` (new, D-16) | test (source fence) | — | `frontend/src/components/layout/__tests__/attentionTab.test.ts:237-290` + `lib/stripComments.testutil.ts` | exact |

---

## Pattern Assignments

### `supabase/migrations/207_library_documents_view.sql` (migration, DDL)

**Analog:** `supabase/migrations/206_retention_hold_hardening.sql` (header, transaction, grants, VERIFY);
`supabase/migrations/200_filtered_retrieval_document_scope.sql` (if EXPLAIN demands an index).
⚠ **No migration in the repo contains `CREATE VIEW` or `security_invoker`** (grep over `supabase/migrations/`
returned nothing). The view body comes from RESEARCH Pattern 1 (`284-RESEARCH.md:434-466`); everything around it
copies 206.

**Header block** (206 `:1-40`): a numbered "WHAT EACH SECTION CLOSES" list, then the apply discipline lines, verbatim in spirit:
```sql
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor. NEVER `supabase db push` /
-- `db reset`. Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ⚠ PRODUCTION: apply 204, then 205, then 206 BEFORE the backend deploy that carries the 275 fix
--   pass (...), then run get_advisors(security).
```
For 207: "apply 207 BEFORE the backend deploy (GET /documents 500s without the view, RESEARCH Pitfall 3), then get_advisors(security)".

**Transaction + grants + reload** (206 `:42`, `:329-342`):
```sql
BEGIN;
...
REVOKE EXECUTE ON FUNCTION public.delete_folder_tree(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_folder_tree(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_folder_tree(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_folder_tree(uuid) TO service_role;
...
COMMIT;

NOTIFY pgrst, 'reload schema';
```
For a view the grant verbs are `REVOKE ALL ON public.library_documents FROM PUBLIC, anon, authenticated;`
then `GRANT SELECT ON public.library_documents TO authenticated, service_role;` (SELECT only keeps an
auto-updatable view read-only — RESEARCH Pattern 1 notes).

**VERIFY block** (206 `:344-383`) — commented `with checks(what, ok) as (values …) select case when ok then 'PASS' else '*** FAIL ***' end` — copy the shape. 207's rows: the view exists with `reloptions` containing `security_invoker=true`; `has_table_privilege('anon','public.library_documents','SELECT')` is false; `authenticated` has SELECT and NOT INSERT/UPDATE/DELETE; view columns = documents columns − `full_markdown` + `{filename_key, version_count, has_earlier}` (P-2); any index is `indisvalid`.

**If an index is needed** (200 `:31-41`, `:82-104`): the TWO-RUN apply — `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` on its own (outside BEGIN), then the BEGIN…COMMIT body opens with a `DO $guard$ … indisvalid … RAISE EXCEPTION` refusal so STEP 1 cannot be skipped silently. Copy that guard verbatim with the new index name.

**Predicate name:** `public.folder_is_org_shared(uuid)` (renamed by migration 111) — never `folder_is_globally_visible` (RESEARCH fact 1).

---

### `scripts/full-schema-supplement.sql` (grant mirror)

**Analog:** itself, `:508-522`. `regenerate-full-schema.sh` dumps `--no-privileges`, so every REVOKE/GRANT lives here.
```sql
-- migration 202 — message_artifacts: owners READ (the messages predicate); only the backend writes.
-- No UPDATE to ANY role, service_role included (D-08: an artifact is immutable once shown).
REVOKE ALL ON TABLE public.message_artifacts FROM PUBLIC;
REVOKE ALL ON TABLE public.message_artifacts FROM anon;
REVOKE ALL ON TABLE public.message_artifacts FROM authenticated;
REVOKE ALL ON TABLE public.message_artifacts FROM service_role;
GRANT SELECT ON TABLE public.message_artifacts TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.message_artifacts TO service_role;
```
Append a `-- migration 207 — library_documents: …` block in the same style after `:564` (the last 204 block). One statement per role (the file's convention), idempotent.

---

### `scripts/apply_migration_207.py` (optional) / the local apply step

**Analog:** `scripts/apply_migration_178.py` (docstring `:1-26`, hard-coded DSN `:33`) and the asyncpg apply recorded in `.planning/milestones/v4.5-phases/275-retention-legal-hold/275-BASELINES.md:270-289`.

Key invariants to copy from 178's docstring:
```python
# ⛔ THE DSN IS HARD-CODED TO 127.0.0.1 AND NO ENVIRONMENT VARIABLE IS READ. Applying 178 to cloud is
#    a production write and needs explicit per-action operator approval ...
# ⚠ THE MIGRATION OWNS ITS OWN TRANSACTION, NOT THIS SCRIPT. The file carries `BEGIN;` / `COMMIT;`
#   (correct for the SQL-editor paste path) ... ⛔ Do NOT "fix" the warnings by stripping BEGIN/COMMIT
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```
275's method (asyncpg, local-DB lock held, then execute each file's commented VERIFY block and print `VERIFY: n/n PASS`, then re-apply once for the idempotency proof). Record in SUMMARY which path was used (SQL editor vs script). Then `bash scripts/regenerate-full-schema.sh` (no `--reset`).

---

### `scripts/seed-scale-284.py` (utility, batch seed) — holds the local-DB lock

**Analogs:**
1. `scripts/build-recall-bench.py` — the destructive-statement guard and bulk insert.
2. `backend/tests/integration/_271_gotrue_users.py` — creating real GoTrue users with exactly one membership.
3. The lock rule (memory `reference_local_db_lock_between_sessions.md`; used verbatim in `278-01-PLAN.md:118`).

**Target guard** (`build-recall-bench.py:83-94,101-207`): refuse anything not loopback + port 54322 + single host + no query string. ⚠ 284 seeds the LIVE `postgres` database (the operator's dev DB), not a throwaway DB — so the guard must refuse by **user scope**, not by database name: every write and every `--teardown` delete is `WHERE user_id = <the synthetic uid>` / `org_id = <the synthetic org>`, resolved from the fixed `scale284@…` email. Copy the "refuse shapes rather than inspecting them" posture (`:112-131`).
```python
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1", "localhost"})
ALLOWED_PORTS = frozenset({54322})
...
hostspec = parsed.netloc.rpartition("@")[2]
if "," in hostspec:
    raise BenchTargetRefused(...)   # asyncpg fails over to later hosts
```

**Bulk insert** (`build-recall-bench.py:827-844`) — CSV `COPY`, not per-row INSERT (50k rows):
```python
async def _copy_csv(conn, table: str, columns: Sequence[str], rows: list[Sequence[Any]]):
    if not rows:
        return
    await conn.copy_to_table(
        table, schema_name="public", columns=list(columns),
        source=io.BytesIO(_csv_batch(rows)), format="csv",
    )
```
Row synthesis with a seeded `random.Random` and deliberate variety (`_document_row`, `:847-868`) — copy the "a bench where every row passes every predicate measures nothing" rule: vary folder (R-07: S10 = 6,000 Root / 3,000 Big / 1,000 spread; S50 = 30,000 / exactly 10,000 / 10,000), `is_latest`, `archived_at`, `status`+`ingestion_step`, `chunk_count`, `source_connection_id`.

**Argparse + `--teardown`** (`:972-1029`): `--teardown` is a separate code path that re-asserts the target first and then proves the operator's corpus count is unchanged (`_run_teardown` `:1029-1044`: "FAIL: the source corpus changed across teardown"). Copy that before/after count assertion against the dev account.

**Users** (`_271_gotrue_users.py:125-165`): `admin.auth.admin.create_user({...,"email_confirm": True})` → delete the signup trigger's personal org → insert exactly ONE `org_members` row → sign in. Two users: the 10k/50k owner and the empty leak-test user B (same org). Teardown mirrors `drop_all` `:167-181` (including `DELETE FROM public.organizations WHERE name = $1` for the `"<email>'s Organization"` leftover).

**Lock** (the agreed protocol):
```bash
LOCK=C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock
( set -o noclobber; echo "284-02 seed $(date -u +%FT%TZ)" > "$LOCK" ) || { echo held; exit 1; }   # wait, never delete another session's lock; stale > 45 min
... seed ...
rm -f "$LOCK"
```
Pitfall 9: close Library tabs during the seed (50k Realtime events); `VACUUM (ANALYZE) documents` after seeding (Pitfall 2).

---

### `scripts/measure-library-284.py` (utility, measurement)

**Analog:** `scripts/build-recall-bench.py` `--report` JSON + `measure_sizes` / `measure_tenant_shares` (`:922-958`), and the `_271_gotrue_users.user_client(access_token)` (`:92-99`) shape for a real-JWT client. Measure through the live backend (`:8000`) with the synthetic user's Bearer token — status, `len(body)` bytes, server time, rows returned, `total` vs an asyncpg `SELECT count(*)` as `postgres`. Write the table to `284-MEASUREMENTS.md` (D-21 before / D-22 after, same columns).

---

### `backend/app/api/documents.py` — `list_documents` (controller, paged read)

**Current code to replace:** `documents.py:741-815` (the `_ID_BATCH` stopgap `:741`, two unbounded legs `:750-770`, Python merge `:773-779`, batched `in_` counts `:783-796`).

**Analog for the paged shape:** `backend/app/api/document_governance.py:224-255` + `:345-349`:
```python
def _pagination_params(
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> tuple[int, int]:
    return offset, limit
...
    res = (
        supabase.table("documents")
        .select("id, filename, folder_id, metadata", count="exact")
        .eq("user_id", _uid(user_id))
        .eq("is_latest", True)
        .eq("metadata->_classification->>status", "suggested")
        .range(offset, offset + limit - 1)
        .execute()
    )
    ...
    return {"items": items, "total": res.count or 0, "offset": offset, "limit": limit}
```
For 284 the params are declared inline on the route (`limit: int = Query(25, ge=1, le=200)`, `offset: int = Query(0, ge=0)`) — RESEARCH Pattern 2 (`284-RESEARCH.md:478-516`) is the full body. Use `aexec(q)` (not bare `.execute()`), `.table("library_documents")`, a named column list (no `select("*")` — `full_markdown`), `.order("created_at", desc=True).order("id", desc=True).range(...)`, and `total = res.count if isinstance(res.count, int) else len(rows)` (the `isinstance` guard is the `_fetch_all` lesson, `document_search_service.py:240-247`).

**Connection-name decoration — keep verbatim** (`documents.py:798-813`), now over ≤ `limit` ids:
```python
conn_ids = sorted({d["source_connection_id"] for d in merged if d.get("source_connection_id")})
conn_names: dict[str, str] = {}
if conn_ids:
    try:
        conn_res = await aexec(
            supabase.table("connector_connections").select("id, name").in_("id", conn_ids)
        )
        conn_names = {r["id"]: r.get("name") for r in (conn_res.data or [])}
    except Exception:
        log.debug("connection-name lookup failed; names stay None")
```

**Validation:** `folder_id` is `"root"` or a UUID with an explicit `HTTPException(422)` (RESEARCH Pitfall 4); `status` a `Literal["in_flight","completed","failed"]`; R-08 `order: Literal["created_desc","updated_desc"]`; R-05 `kind: Literal["spreadsheet"] | None` applying a CONSTANT `or_` of mime/extension patterns (no user value interpolated).

**Docstring:** the first paragraph carries the breaking-change notice (R-06) — the public builder keeps "summary + the first paragraph".

**Route order trap:** if `GET /{document_id}` is added, any literal sub-path under `/documents` must be declared BEFORE it (RESEARCH anti-pattern; the summary lives in `library.py` to avoid this).

**Do not touch:** `upload_document` / `delete_document` — `ast.If` count fences (275 D-32, RESEARCH ledger table).

---

### `backend/app/api/documents.py` — `GET /documents/{document_id}` (new, D-11) and `_assert_document_visible`

**Analog:** `documents.py:944-985`:
```python
async def _assert_document_visible(document_id: str, user_id: str, supabase: Client) -> dict:
    try:
        res = await aexec(
            supabase.table("documents")
            .select("id, filename, user_id, folder_id")
            .eq("id", document_id)
            .eq("user_id", user_id)
            .maybe_single()
        )
    except Exception:
        ...
    global_folder_ids = await get_globally_visible_folder_ids(supabase, user_id)
    ...
    raise HTTPException(status_code=404, detail="Document not found")
```
With the view the two arms collapse into ONE `.table("library_documents").select(...).eq("id", id).maybe_single()` read (+ `maybe_row` from `app.utils.db`). Keep the uniform 404 detail string and the T-217-04/05 docstring rule ("an invisible document is a 404 — never an empty 200"). Validate the id as a UUID first (malformed → 422, not a PostgREST 22P02 500).

---

### `backend/app/api/documents.py` — `/chunks`, `/tables`, `/images`, `/versions` (paged per-document lists)

**Analog:** `get_document_conversation`, `documents.py:1082-1150` — the only per-document route that already reports its bound:
```python
CONVERSATION_SIBLING_CAP = 200
...
    res = await aexec(
        supabase.table("documents")
        .select("id, filename, metadata, created_at", count="exact")
        .eq("user_id", owner_id)
        .eq("thread_key", thread_key)
        .order("created_at")
        .limit(CONVERSATION_SIBLING_CAP)
    )
    rows = res.data or []
    total = res.count if getattr(res, "count", None) is not None else len(rows)
    ...
    return ConversationResponse(messages=messages, total=total, truncated=total > len(messages))
```
Current bodies: chunks `:1058-1079`, tables `:1168-1188`, images `:1191-1212`, versions `:818-845` (⚠ versions calls `.execute()` bare twice — route through `aexec`). Add `limit: int = Query(<default>, ge=1, le=<max>)`, `offset: int = Query(0, ge=0)`, `count="exact"`, `.range(offset, offset+limit-1)` (chunks keep `.order("chunk_index")`, tables `table_index`, images `image_index`, versions `version_number desc`). Defaults per UI-SPEC S9/S10: chunks 200 (max 500), tables 50, images 100, versions 50. The RLS asymmetry comment block `:1153-1165` stays verbatim.

---

### `backend/app/api/library.py` — `GET /library/summary` (controller, aggregate)

**Analog:** same file, `get_index_summary` `:61-137`. Imports (`:30-38`) and the route frame:
```python
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.dependencies import get_current_user, get_user_pg_connection

router = APIRouter(prefix="/library", tags=["library"])
...
@router.get("/index-summary", response_model=IndexSummary)
async def get_index_summary(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> IndexSummary:
    """One RLS-enforced GROUP BY over the caller's own corpus. Ungated per D-217.1-27."""
    async with get_user_pg_connection(request, current_user) as conn:
        totals_row = await conn.fetchrow("""SELECT ... FROM public.document_chunks dc""")
        folder_rows = await conn.fetch("""SELECT d.folder_id, ... GROUP BY d.folder_id, f.name ...""")
```
Copy: the module-docstring "RLS-ENFORCED, NOT SERVICE-ROLE — deliberately unlike its neighbours" paragraph (`:12-19`) adapted to the view; Pydantic response models declared in the module (`:41-58`); the `D-217.1-31` "null-folder bucket reads Root" rule (`:115-116`). The SQL is RESEARCH Pattern 3 (`284-RESEARCH.md:524-546`, one `GROUPING SETS` scan over `public.library_documents WHERE is_latest`), then ONE `SELECT id, name FROM public.connector_connections WHERE id = ANY($1::uuid[])` (⚠ name only `id, name` — column grants). ⚠ Note `:21-23` of the docstring says the index-summary GROUP BY "inherits the org-shared merge automatically" — it reads `public.documents` (RLS-wide), NOT the Library set; the new summary must read the VIEW so its numbers equal `GET /documents`' totals.

---

### `backend/app/models/document.py` (envelopes)

**Analog:** `ConversationResponse` `:175-184`:
```python
class ConversationResponse(BaseModel):
    """A conversation, and an honest statement about whether it is all of one."""
    messages: list[ConversationMessage] = []
    #: Total siblings sharing the key, INCLUDING any beyond the cap.
    total: int = 0
    #: ⛔ True when `messages` is a slice. ...
    truncated: bool = False
```
New: `DocumentListResponse {documents: list[DocumentResponse], total: int, offset: int, limit: int}` (the Find vocabulary — D-01), and per-doc page envelopes `{<items>, total, offset, limit}` for chunks/tables/images/versions. `DocumentResponse` (`:30`) is reused as the row model unchanged.

---

### `backend/app/services/document_view_resolver.py` + `backend/app/api/document_views.py`

**Analog:** itself, `resolve_filter` `:289-412`. Keep `_apply` (`:342-351`, the ONE fragment walk, `apply_fragments` D-115-6) unchanged. Two strategies (RESEARCH Pattern 5, `284-RESEARCH.md:560-565`):
- route path (`via_view=True`): `supabase.table("library_documents").select(<cols>, count="exact")` → `_apply(q).eq("is_latest", True)` → order → `.range()`; `count_only` → `.select("id", count="exact").limit(1)` and return `res.count`.
- agent path (`via_view=False`, service role — the view returns 0 rows to it, Pitfall 1): the existing two legs `:383-399`, each `.order("created_at", desc=True).limit(limit)`, exact total from three `count="exact"` head reads.

The `count_only` block being replaced (`:356-380`) is the one that silently tops out near 1,000 per leg.

Route params (`document_views.py:202-260`, `:263-300`): add `limit/offset` the governance way (`Query(…, ge=, le=)`), and for `POST /resolve` add `offset: int = Field(default=0, ge=0)` / `limit: int = Field(default=25, ge=1, le=200)` to `AdHocResolve` — the exact shape of `DocumentSearchRequest` (`models/document_search.py:164-165`). Keep the `ResolveError → HTTPException(status, detail)` remap (`:259-260`, `:299-300`).

**Agent call site** `backend/app/services/tools/documents.py:514-528`: today `count_only=True` then a full resolve sliced `[:limit]`; pass `limit` into the core instead and keep the output byte-identical for ≤ 50 rows (a unit test asserts it — otherwise a cross-provider UAT is owed).

---

### `backend/app/services/document_search_service.py` (Find in SQL)

**Analog:** itself. Keep the appliers `:161-229` and the `structure()` composition `:446-455` exactly:
```python
    def structure(q):
        q = apply_fragments(q, fragments)  # the SHARED walk (no fork, D-115-6)
        q = _apply_name(q, req)
        q = _apply_folder(q, folder_ids)
        q = _apply_added_by(q, req, caller)
        q = _apply_dates(q, req)
        q = _apply_version(q, version)
        q = _apply_archived(q, req.include_archived)
        q = _apply_ids(q, id_allow)
        return q
```
Replace `_candidates` own/glob legs (`:457-478`), `_fetch_all` (`:235-257`), `_lineage_rows`/`_lineage_facts` (`:283-332`), `_sort_rows` (`:405-427`), the Python slice (`:571-573`) and `_hydrate`'s `in.(page ids)` re-read (`:481-488`) with ONE builder over the view: `structure(supabase.table("library_documents").select(FIND_SELECT, count="exact"))` → `has_earlier` as `.eq("has_earlier", True)` → `.order(col, desc=desc, nullsfirst=False).order("id")` → `.range(req.offset, req.offset + req.limit - 1)`. `older_matches` = same pipeline, `select("id", count="exact").limit(1)`. Keep `_zero_result` (`:133-142`) — same keys on every answer (no existence oracle) — and the connection-name decoration (`:493-508`). Retire the "two legs, never one `or_`" docstring rule and `test_271_search_core.py::test_legs_are_two_queries…` with the reason in the commit (RESEARCH Pattern 4). Relationship allow-lists `:334-402` stay (bounded by one document's edges) plus a fail-loud cap via the existing `SearchTruncatedError` (`:120-130`).

---

### `backend/tests/unit/test_284_route_inventory.py` (static fence, D-23 layer 1)

**Analog:** `backend/tests/unit/test_283_settings_route_inventory.py` — copy its whole structure:
- module docstring "WHAT THIS FENCE PROTECTS / THE INVENTORY / HOW A ROUTE'S … IS READ / Driven RED" (`:1-26`);
- `_is_<domain>_route(route)` by `endpoint.__module__` set (`:56-60`);
- `_inventory(routes)` one row per method, skipping HEAD/OPTIONS (`:63-74`);
- `_violations(rows)` with an `ALLOW_LIST` exempt (`:33`, `:77-88`) — for 284 `ALLOW_LIST: dict[(method, path), str]` carries the reason string (RESEARCH route inventory table `284-RESEARCH.md:357-380`);
- non-vacuity floors (`:97-100`: `assert len(rows) >= 5`, exact gated count);
- the permanent detector self-test over a throwaway `APIRouter` + `FastAPI()` (`:120-149`).
```python
def _throwaway_routes():
    router = APIRouter(prefix="/settings")
    @router.get("/naked")
    async def naked():  # pragma: no cover - never called
        return {}
    throwaway = FastAPI()
    throwaway.include_router(router)
    return throwaway.routes
```
**Reading the bound:** walk `route.dependant.query_params` for `offset` and a `limit` whose `field_info.metadata` carries `le`, AND recurse into `route.dependant.dependencies` the way `_require_visible_features` walks its stack (`:36-53`) — ⚠ `document_governance.py` declares its paging through a sub-dependency (`Depends(_pagination_params)`, `:345-349,382`), so a detector that reads only top-level query params would call `/unclassified` unbounded. For POST bodies, read the body model's `limit` field `le` (`DocumentSearchRequest.limit` `le=100`). Make the detector FAIL LOUDLY if it cannot read a field's metadata, exactly like `:47-50`.

---

### `backend/tests/unit/test_284_request_recorder.py` (runtime guard, D-23 layer 2)

**No direct analog for recording PostgREST requests.** Two precedents compose it:
1. **The seam:** `backend/app/dependencies.py:180-216` — every user-JWT client shares ONE module-global `_shared_httpx` passed as `ClientOptions(httpx_client=_get_shared_httpx())`. Monkeypatching `app.dependencies._shared_httpx` to an `httpx.Client(event_hooks={"request": [RECORDED.append]})` before building the client records every request (RESEARCH Code Examples `284-RESEARCH.md:635-669` has the full `violations()` body).
2. **Asserting on the real `httpx.Request`:** `backend/tests/unit/test_mcp_egress_hardening.py:185-209`:
```python
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={...})

    real_init = httpx.AsyncClient.__init__
    def patched_init(self, *args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        real_init(self, *args, **kwargs)
    monkeypatch.setattr(httpx.AsyncClient, "__init__", patched_init)
    ...
    assert seen, "no request reached the transport"
```
For a unit-level (no live DB) variant use `httpx.Client(transport=httpx.MockTransport(handler))` returning canned PostgREST bodies with a `Content-Range` header, and the same docstring discipline ("the effect is pinned rather than the plumbing", `:169-173`). The live variant (against the seeded account) goes under `tests/integration/` and holds the DB lock. Distinguish `folder_id in.()` (bounded by folders) from `id`/`document_id in.()` (bounded by the page) — RESEARCH Pattern 4 notes. RED plant: re-insert the `_ID_BATCH` loop (`documents.py:741,789-793` as it reads today).

---

### `backend/tests/unit/test_284_find_sql.py`

**Analog:** `backend/tests/unit/test_271_search_core.py:109-269` — `FakeQuery` records every builder call and EVALUATES them against canned rows, including `order`, `range`, `count="exact"` and a `max_rows` cap:
```python
    def execute(self):
        ...
        rows = [r for r in self.client.tables.get(self.table, []) if self._match(r)]
        for col, desc in reversed(self._order):
            rows.sort(key=lambda r: (_get(r, col) is None, str(_get(r, col))), reverse=desc)
        count = len(rows) if self.count_mode == "exact" else None
        if self._range is not None:
            s, e = self._range
            rows = rows[s:e + 1]
        ...
        if self.client.max_rows is not None:
            rows = rows[: self.client.max_rows]
```
and `FakePostgrest.rpc` raises (`:259-260`: "the search path never calls an RPC"). Extend (don't fork) for `library_documents`: `eq("has_earlier", True)`, `nullsfirst` kwarg (already swallowed by `**_k` at `:160`), and a `candidate_legs()` helper keyed on the new table. Prove: one view read with `range` + `count=exact`; no `_fetch_all`/`_sort_rows` remain (a `?raw`-style `inspect.getsource` check); `max_rows=1000` with 1,500 matches still yields `total == 1500`.

---

### `backend/tests/integration/test_284_*_live.py` (list, summary, two-user leak, parity P-1)

**Analog A (asyncpg handler driven in-process as a user):** `backend/tests/integration/test_2171_index_summary_rls.py`:
- skip guard `:47-81` (`PG_AVAILABLE` + `pytestmark = pytest.mark.skipif(...)` — a skip is a SKIP, never a pass);
- the RLS seam patch `:135-162`:
```python
@asynccontextmanager
async def _user_conn(pool, uid: str):
    from app.dependencies import _apply_rls_user_context
    async with pool.acquire() as conn:
        async with conn.transaction():
            await _apply_rls_user_context(conn, uid)
            yield conn

def _patch_route_rls(pool):
    from app.api import library as library_api
    def _patched(request, current_user):
        return _user_conn(pool, current_user["id"])
    library_api.get_user_pg_connection = _patched  # noqa: SLF001 (test seam)
```
- non-vacuity + both-direction leak assertions `:206-230`.

**Analog B (PostgREST handlers as a real GoTrue user):** `backend/tests/integration/_271_gotrue_users.py` — `require_gotrue()` (`:74-84`), `GoTrueUsers.create_signed_in_user` (`:132-165`), `user_client(token)` (`:92-99`, ANON key + Bearer — RLS enforced; the service-role key is ONLY for the admin API). Pass that client as `supabase=` to `list_documents(...)` / `search_documents(...)`. Also assert a service-role read of `library_documents` returns 0 rows (fail-closed, Pitfall 1).

**Retire:** `backend/tests/unit/test_261014_list_documents_batches_in.py` (pins `_ID_BATCH = 100`, `:20`) — deleted with the stopgap, reason in the commit (R-11).

---

### `docs/public/api/concepts/pagination.md` + OpenAPI snapshot

**Analog:** itself — today frontmatter only, `status: stub` (`summary:` says list endpoints page with `limit, offset or page_size`). Fill the body with the envelope `{documents,total,offset,limit}`, the `GET /documents` breaking-change note, and a paging loop. Then `backend/venv/Scripts/python scripts/export-openapi.py` → `node scripts/build-public-openapi.cjs` (`--check`), `node scripts/check-docs-coverage.cjs`, `test_276_openapi_snapshot_fresh.py`, `publicOpenapi.test.ts` (RESEARCH Validation table). Changelog entry: recorded as owed at v4.6 close (R-06).

---

### `frontend/src/hooks/useLibraryDocuments.ts` (new hook — the D-24 seam)

**Analog:** `frontend/src/hooks/useDocumentFind.ts` (request-keyed fetch) — copy the module docblock shape ("THE THREE RULES"), the result interface, and the stale-answer guard:
```ts
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)
  const key = request === null ? null : JSON.stringify(request)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const myReq = ++reqIdRef.current
    ...
    setLoading(true)
    timerRef.current = setTimeout(() => {
      searchDocuments(body)
        .then((res) => {
          if (myReq !== reqIdRef.current) return
          setRows(res.documents)
          setTotal(res.total)
          setError(null)
        })
        .catch((e: unknown) => {
          if (myReq !== reqIdRef.current) return
          // Rule 3: rows and total are deliberately left as they were.
          setError(...)
        })
        .finally(() => {
          if (myReq === reqIdRef.current) setLoading(false)
        })
    }, debounceMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [key, debounceMs, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
```
(`useDocumentFind.ts:51-103`.) Rule 3 (keep rows on error) is exactly UI-SPEC S1 "Error, warm". Add the cold-vs-warm distinction (folder/view switch = cold → clear rows; page change = warm → keep rows) that UI-SPEC §Loading vocabulary requires; `total: number | null` (`null` until answered — never 0 before an answer).

**Wave 1 body** (behaviour-preserving): move the derivations verbatim out of `LibraryPage.tsx` — `inFlightCount` `:310-316`, `selectedDoc` `:384-392`, `folderDocuments` `:435-438`, `rootDocumentCount` `:445-447`, `folderDocumentCounts` `:452-458`, `folderScopedDocuments` `:656-662`, `splitArchived` `:668-670`, pager state + slice `:674-685` — over `useDocuments()`, and return a summary-SHAPED object (RESEARCH Pattern 6). ⚠ Moving these takes the seven `.folder_id` reads with them, so `LibraryPage.cloudImport.test.tsx:382` (`toBe(7)`) must be re-pinned deliberately (R-11 / Pitfall 5); `:377` (`not.toMatch(/\bfolder_id\s*:/)`) stays.

**Wave 2 body:** the same return shape from `listDocumentsPage` + `getLibrarySummary` + `getDocument(id)`.

---

### `frontend/src/hooks/useDocuments.ts` (D-08 refetch)

**Analog:** itself. Keep the channel setup `:30-45`, the cleanup `:106-112`, and the UPDATE spread-merge + its Phase 217 comment block `:47-86` verbatim (it preserves `tables_stage_applies` / `images_stage_applies` — ledger invariant):
```ts
              setDocuments((prev) =>
                prev.map((d) => (d.id === newDoc.id ? { ...d, ...newDoc } : d)),
              )
```
Replace the INSERT prepend (`:90-95`) and DELETE filter (`:96-97`) with a debounced (~500 ms) refetch of page + summary; reuse the `timerRef` pattern from `useDocumentFind.ts:51,57,73`. The optimistic upload row (`:115-129`) stays until the refetch reconciles it. `useDocuments.test.ts` pin 7: the INSERT/DELETE cases become "triggers a debounced refetch" in place (Pitfall 7).

---

### `frontend/src/hooks/useDocumentPicker.ts` (new) — or call `useDocumentFind` directly

**Analog:** `useDocumentFind` already takes `debounceMs` (`:36-42`) and drops stale answers. A picker can call:
```ts
useDocumentFind({
  request: open ? { filter_expr: EMPTY_FILTER, name: q || null, version: "latest", sort: "added_desc",
                    offset: 0, limit: 20, include_archived: true } : null,
  debounceMs: 250,
})
```
⚠ `DocumentSearchRequest` in `types/index.ts:708-732` has no `include_archived` field (Find adds it as an optional `true` in `pages/findState.ts:300,337`). Add `include_archived?: boolean` to the TS type in the plan that owns `types/index.ts` (02). Rule 1 (`request: null` → zero requests) gives "no request while the dialog is closed" for free.

---

### `frontend/src/lib/api/documents.ts`, `lib/api/library.ts`, `lib/api.ts`, `types/index.ts` (wire contract — ONE plan owns all four)

**Analog for a GET with params:** `getDocumentContent` `lib/api/documents.ts:435-447`:
```ts
export async function getDocumentContent(id: string, opts?: { startLine?: number; endLine?: number }) {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (opts?.startLine != null) params.set("start_line", String(opts.startLine))
  ...
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/documents/${id}/content${qs ? `?${qs}` : ""}`, { headers })
  if (!res.ok) throw new Error("Failed to load document text")
  return res.json() as Promise<DocumentContentResponse>
}
```
**Analog for a typed failure:** `DocumentSearchError` + `searchDocuments` `:176-208` (network vs status). `listDocumentsPage(params)` copies that shape, and accepts both shapes for one release (`Array.isArray(body) ? legacy : envelope`, RESEARCH Pitfall 3). `listDocuments()` (`:30-35`) is removed or made to require params (D-16).

**Summary client:** `lib/api/library.ts:16-21`:
```ts
export async function getIndexSummary(): Promise<IndexSummary> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/library/index-summary`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to load library index summary")
  return res.json() as Promise<IndexSummary>
}
```
`getLibrarySummary()` sits beside it, same `cache: "no-store"`.

**Barrel rule:** every new runtime export must be re-exported from `lib/api.ts` (`apiBarrel.test.ts`, D-207-06 — `lib/api/documents.ts:417-420`); consumers of `searchDocuments` import from `@/lib/api/documents` directly (`:189-192`, the 196-08 lesson). Types: copy `DocumentSearchResponse` (`types/index.ts:739-748`) for `DocumentListResponse` and `LibrarySummary` — additive only (ledger).

---

### `frontend/src/pages/LibraryPage.tsx`

**Analog:** itself. The list column (`:914-951`) keeps `data-testid="documents-doclist"`, the archived-hidden rule `:917`, `ArchivedHiddenLine` `:932-936`, `data-testid="documents-tfoot"` `:940`. Changes: `documents={pagedDocuments}` → the hook's server rows; `<DocumentsPager total={…server total…} exact />`; `<LibraryStatTiles>` `:1017` and `<FolderDetail>` `:1036-1038` receive numbers; `totalDocuments={documents.length}` `:1136` → `summary.total`; `corpusCount={listDocuments.length}` `:1069` → server total. Cold/warm/error states from UI-SPEC S1 reuse the `DocumentsFindBody` treatments below. Invariants that must survive (RESEARCH ledger row): `SHED_COLUMNS_3_TO_5` selector, `const canUploadToFolder =` once / identifier ×4, no `useSourceAttention()` call, `<IngestionTab … onNavigateToConnections={…}>`, no `max-w-*`.

**States to copy** (`components/library/find/DocumentsFindBody.tsx`):
```tsx
  // Zero is a CLAIM about the answer, so it is only made once there is one.
  const isZero = !loading && error === null && total === 0
  ...
        <div role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2">
          <p className="text-sm text-destructive">{"Couldn't run this search. Your filters are kept."}</p>
          <button type="button" onClick={onRetry}
            className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded">
            Try again
          </button>
        </div>
  ...
        <div data-testid="find-results" aria-busy={loading ? "true" : undefined}
          className={cn("transition-opacity", loading && "opacity-60")}>
```
(`:173-174`, `:189-202`, `:220-224`.) Cold skeleton: `DocumentChunksSection.tsx:85-91` with 6 bars and "Loading documents".

---

### `frontend/src/components/library/DocumentsPager.tsx`

**Analog:** itself. Delete `ROW_CAP` (`:24-25`), `capped` (`:49-50`), the `+` branch in `:79`, the cap line `:105-109`, and the `exact` prop becomes either required-true or removed; update the docblock (`:1-11`) which still says "`GET /documents` is unpaginated". The string "The list may be larger than shown" must not exist in `frontend/src` afterwards (UI-SPEC S2). Retire the cap cases in `DocumentsPager.exact271.test.tsx` and `LibraryPage.test.tsx:557` in place (Pitfall 7, keep per-file counts).

---

### `frontend/src/components/library/LibraryStatTiles.tsx` and `frontend/src/components/ingestion/FolderDetail.tsx`

**Analog:** the VECTORS tile's tri-state, `LibraryStatTiles.tsx:20,97-115`:
```tsx
const UNKNOWN = "Not known yet"
...
        value={
          vectors.error
            ? UNKNOWN
            : vectors.value === null
              ? "…"
              : vectors.value.total !== null
                ? vectors.value.total.toLocaleString()
                : UNKNOWN
        }
        description={vectors.error ? "—" : vectors.value === null ? "…" : vectors.value.model ?? "—"}
```
CHUNKS (`:70-73,92-96`) switches from `documents.reduce(...)` to `summary.chunks` with the same tri-state. `FolderDetail` (`:5-9,27-46`) changes `documents: Document[]` to `count: number | null`, `sizeBytes: number | null` + a load state; keep `formatBytes` / `formatDate` and the layout (UI-SPEC S5: loading `…`, failed "Count not known yet"; the shared badge / subfolder / Created stay).

---

### `frontend/src/components/library/LibraryHeaderBar.tsx`

**Analog:** itself `:229-243`. The idle arm already branches on `typeof totalDocuments === "number"`; add the summary loading ("Counting…") and failed ("Count not known yet") arms there, grouped numbers (`toLocaleString()`). The `inFlight` prop (`:49`) is fed from `summary.status.pending + processing` (R-04).

---

### `frontend/src/components/library/IngestionTab.tsx`

**Analog:** itself. The stage-card fold `:150-158` (`cardForStage(doc.ingestion_step)`) becomes a fold over `summary.steps`; `inFlight` / `completedDocs` / `failed` / `pausedDoc` (`:173-183`) become summary numbers (`rate_limited_in_flight` for the banner, R-04 drops `paused`). History keeps `PaginationControls` (`:460-466`, `{offset, limit, total, onChange}` — `components/health/PaginationControls.tsx:4-15`) with the server total and `order=updated_desc` (R-08); apply the same control to Queue and Needs attention. The `documents: Document[]` prop (`:105`) goes away. 42+5+6 pinned cases (RESEARCH ledger).

---

### `frontend/src/components/metadata/DocumentChunksSection.tsx` (scroll-to-end paging)

**Analog (own states — keep verbatim):** loading `:85-91`, error + Try again `:93-106`, empty `:108-114`, the bounded region `:116-130`:
```tsx
        <div
          role="region"
          aria-label={`Chunk list, ${rows.length} ${rows.length === 1 ? "chunk" : "chunks"}`}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1.1 ...
          tabIndex={0}
          className="max-h-96 overflow-y-auto rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
```
⛔ No height cap / overflow utility on chunk bodies (`:163-166`, 283-REVIEW CR-01). `onTotalChange?.(res.length)` (`:73`) becomes `onTotalChange?.(res.total)`.

**Analog (sentinel):** no in-app scroll sentinel exists. Closest IntersectionObserver usage is `frontend/src/docs/components/TocPill.tsx:31-54` — guarded for jsdom, disconnected on cleanup:
```tsx
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(() => recompute(), { rootMargin: `-${ACTIVE_LINE}px 0px 0px 0px` })
      for (const h of headings) { const el = document.getElementById(h.id); if (el) io.observe(el) }
    }
    ...
    return () => { ...; io?.disconnect() }
```
For 284: `root` = the region element (a ref), observe a non-focusable sentinel after the last `<li>`, load the next 200 when it intersects and `loaded < total`. Because jsdom has no IntersectionObserver, the test must stub one (file-local, the `test-utils/mockReactFlow.ts` rule: never in `setupTests.ts`) and fire its callback by hand. UI-SPEC S9 copy: "Loading more chunks", "Couldn't load more chunks" + Try again; no "Show all"/"Load more" button.

---

### `DocumentTablesSection.tsx`, `DocumentImagesSection.tsx`, `DocumentRow.tsx` `VersionHistoryPanel` ("N of M")

**Analog:** `frontend/src/components/metadata/DocumentConversationSection.tsx:111-119`:
```tsx
      <div className="flex items-center gap-1.5 pb-2 text-xs text-panel-muted-foreground">
        <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          {total} messages in this conversation
          {truncated ? `, showing the first ${messages.length}` : ""}
        </span>
      </div>
```
UI-SPEC S10 copy: "{M} tables in this document, showing the first {N}" / "{M} image descriptions in this document, showing the first {N}" / "{M} versions, showing {N}" (the last under the version table, `text-xs text-muted-foreground`). Line renders only when N < M. `VersionHistoryPanel` is `DocumentRow.tsx:155` (fetch at `:172`); DocumentRow's 7-column order is untouched.

---

### `CreateLinkDialog.tsx` + `LinkTargetCombobox.tsx` (server typeahead, S11)

**Analog:** no shipped dialog runs a debounced server search (grep for `debounce` in `components/` finds only FilterBar, RuleBuilderPanel, DocumentsFindBody, NavPanel, ChatLayout, SourcesAttentionSection, ShikiCode — none a dialog). Compose from `useDocumentFind` (above) + the existing combobox.

Current whole-library read to remove — `CreateLinkDialog.tsx:78-86`:
```tsx
  useEffect(() => {
    if (!open) return
    setRelType("references")
    setTarget("")
    setError(null)
    listDocuments()
      .then(setCandidates)
      .catch(() => setError("Could not load documents."))
  }, [open])
```
and `targetDoc = candidates.find(...)` `:107` → keep the CHOSEN document object in state (UI-SPEC "the chosen document is retained as an object").

`LinkTargetCombobox` client filter `:64-70` is the Pitfall 10 double-filter:
```tsx
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates
      .filter((d) => !excludeIds.has(d.id))
      .filter((d) => (q === "" ? true : d.filename.toLowerCase().includes(q)))
      .slice(0, maxVisible)
  }, [candidates, excludeIds, query, maxVisible])
```
Server mode: optional `onQueryChange` + `loading` / `error` / `hasMore` / `onRetry` props; when `onQueryChange` is set, skip the name filter (keep `excludeIds`). Status/alert lines render AFTER the `<ul role="listbox">` (`:138-172`), never inside it. Keep WR-04 (`aria-controls` only while listed, `:116-120`) and the keyboard walk `:92-104`.

---

### `StructurePopovers.tsx` + `FindQuickAdd.tsx` (S12)

**Analog:** itself. `AddedByEditor` `:403-434` derives connections from `documents`:
```tsx
    for (const d of documents) {
      if (d.source_connection_id && !connections.has(d.source_connection_id)) {
        connections.set(d.source_connection_id,
          `${d.source_connection_name ?? "Unnamed connection"} (connected source)`)
      }
    }
```
→ take `connections: readonly {id, name, count}[]` from `summary.connections` (keep the label format, sort, and the "You" / "Anyone else" bookends). `DocumentTypeEditor` `:627-648` → `summary.document_types`. `RelationshipEditor` `:234-254` (`candidates = documents.filter(d => d.is_latest !== false)`) → the server-mode combobox, `maxVisible={8}`. `FindQuickAdd` passes `documents` at `:50,132,183,195,239` — RESEARCH conflict rule: make the prop optional in the Find plan, remove the pass-through in the Library plan.

---

### `LegalHoldDialog.tsx` (S13)

**Analog:** itself. Remove the open-time whole-library read `:147-156` and shrink `inActiveOrg` (`:57-64`) to run over ≤ 20 returned ids (one `getDocumentStates` call; `STATE_CHUNK` loop disappears):
```tsx
async function inActiveOrg(docs: readonly Document[]): Promise<Document[]> {
  const ids = docs.map((d) => d.id)
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += STATE_CHUNK) chunks.push(ids.slice(i, i + STATE_CHUNK))
  const answers = await Promise.all(chunks.map((c) => getDocumentStates({ document_ids: c, folder_ids: [] })))
  ...
```
Keep the generation guard (`openGen` / `alive`, `:120-133,148,152`) — it is the dialog's own stale-answer rule, combine it with the hook's `reqIdRef`. Failure copy uses `AMBER_TEXT_CLASS` (`:40`), replacing today's silent `.catch(() => {})` (`:154-156`). "More documents match…" carries no number (UI-SPEC S13).

---

### `TakeoffSection.tsx` (S14, the R-05 exception)

**Analog:** itself `:73-103` — the client-side spreadsheet filter becomes a server `GET /documents?kind=spreadsheet&limit=50` read:
```tsx
        const allDocs = await listDocuments()
        if (!cancelled) {
          const sheets = allDocs.filter((d) => {
            const name = d.filename.toLowerCase()
            return name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv") ||
              d.mime_type?.includes("spreadsheet") || d.mime_type?.includes("csv")
          })
          setRateDocs(sheets)
          if (!selectedRateDocId && sheets.length > 0) setSelectedRateDocId(sheets[0].id)
        }
      } catch {
        // Non-blocking
      }
```
Keep the `cancelled` flag and the auto-select-first; the five predicates move server-side as a constant `or_` (no user value). Replace the silent `catch` with the S14 failed option + Try again; add the "Showing the 50 most recent of {M} spreadsheets." line when `total > 50`.

---

### `frontend/src/test-utils/fakeLibraryApi.ts` (new test helper)

**Analogs:**
- **Location / file-local rule:** `frontend/src/test-utils/mockReactFlow.ts` (docblock: "kept FILE-LOCAL … Do NOT move any of this into `src/setupTests.ts`"). Test-only helpers elsewhere carry the `.testutil.ts` suffix (`lib/stripComments.testutil.ts`, `lib/apiSource.testutil.ts`: "Nothing under `src/` outside a `*.test.*` file may import it").
- **A fake that answers FROM the request against a fixture:** `components/retention/__tests__/LegalHolds.test.tsx:89-97`:
```ts
  m.listDocuments.mockResolvedValue(DOCS)
  m.getDocumentStates.mockImplementation(async (body: { document_ids: string[] }) => ({
    documents: body.document_ids.filter((id) => id !== "d-other").map((id) => ({ document_id: id })),
    folders: [],
    can_manage: true,
  }))
```
- **Evaluate filters / order / range like the server does:** `backend/tests/unit/test_271_search_core.py:224-245` (`FakeQuery.execute`) — the same idea in TS: `listDocumentsPage({folder_id, include_archived, status, order, offset, limit})` filters the fixture, sorts `created_at desc, id desc`, slices, returns `{documents, total, offset, limit}`; `getLibrarySummary()` aggregates the SAME fixture; `getDocument(id)` finds or rejects 404.
- **Wiring in a suite:** the partial module mock in `pages/__tests__/LibraryPage.find271.test.tsx:91-94`:
```ts
vi.mock("@/lib/api/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/documents")>()
  return { ...actual, searchDocuments: mockSearchDocuments }
})
```
and the hoisted-mock block `LibraryPage.test.tsx:26-45` + the `beforeEach` `mockUseDocuments.mockReturnValue({documents: sampleDocuments, …})` (`:189-197`). Wave 2 swaps that one `mockReturnValue` for `fakeLibraryApi(sampleDocuments)` in each of the nine suites (Pitfall 6), so no per-file case count decreases. `sourceComposition.test.tsx` has a standing red — compare against base, never fix it here.

---

### D-16 frontend fence (new, e.g. `frontend/src/lib/__tests__/libraryListFence.test.ts`)

**Analog:** `frontend/src/components/layout/__tests__/attentionTab.test.ts:237-290`:
```ts
  const RAW = import.meta.glob("../../../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>

  /** `src/`-relative path for a glob key — Vite normalises keys to DIFFERENT depths. */
  const HERE = "src/components/layout/__tests__"
  const rel = (key: string): string => { ... }

  const isProductFile = (key: string) => {
    const p = rel(key)
    if (/\.test\.tsx?$/.test(p)) return false
    if (p.includes("__tests__/")) return false
    ...
  }
  ...
  it("self-guard: the sweep really loaded the tree and the stripper really strips", () => {
    expect(Object.keys(RAW).length).toBeGreaterThan(200)
```
Use the shared `stripComments` from `lib/stripComments.testutil.ts` (not a local copy — its docblock explains why). Patterns to fail on (RESEARCH `284-RESEARCH.md:674-675`): `listDocuments\(\s*\)`, `` fetch\(`\$\{API_BASE\}/documents` `` with no `?`, any whole-list import outside `lib/api/documents.ts`. RED plant: an in-memory mutated `CreateLinkDialog.tsx` source string run through the same detector (the throwaway-router idea from `test_283`).

---

## Shared Patterns

### User-JWT reads, never the service role (V4)
**Source:** `backend/app/dependencies.py:196-216` (`get_user_supabase`, ANON key + Bearer, shared httpx) and `:158-177` (`get_user_pg_connection`, `SET LOCAL ROLE authenticated` first, both GUC forms, `is_local := true`).
**Apply to:** every list / count / single / Find / resolve / summary route. Routes take `supabase: Client = Depends(get_user_supabase_client)` (`documents.py:747`) or `request: Request` + `get_user_pg_connection(request, current_user)` (`library.py:63-67`). The agent tool path keeps the service role and therefore the two-leg resolve (R-02).

### Blocking supabase-py calls are wrapped (D-v2.5-01)
**Source:** `from app.utils.db import aexec, maybe_row` (`documents.py:39`); `await aexec(supabase.table(...)...)` (`documents.py:1073-1078`), or `await run_in_threadpool(_fetch_unclassified, ...)` for a sync helper (`document_governance.py:391`).
**Apply to:** every rewritten handler — `list_documents` (`:750-770`) and `list_document_versions` (`:826-844`) call `.execute()` bare today.

### Exact totals, never `len()`
**Source:** `select(..., count="exact")` + `res.count` with an `isinstance(total, int)` guard (`document_search_service.py:243-247`; `documents.py:1124,1131`).
**Apply to:** list, per-doc lists, view resolve (incl. `count_only`), Find, `older_matches`.

### One paging vocabulary
**Source:** Find's envelope `{documents, total, offset, limit}` (`document_search_service.py:580-587`, `_zero_result` `:133-142`; TS `types/index.ts:739-748`), params via `Query(…, ge=0)` / `Query(…, ge=1, le=MAX)` (`document_governance.py:345-349`) or Pydantic `Field(ge, le)` for bodies (`models/document_search.py:164-165`).
**Apply to:** `GET /documents`, both view resolves, per-doc lists, IngestionTab lists.

### Uniform 404, no existence oracle
**Source:** `_assert_document_visible` (`documents.py:944-985`, `detail="Document not found"`), `resolve_view`'s "404-not-403" (`document_views.py:235-239`), Find's same-keys zero shape (`:133-142`).
**Apply to:** `GET /documents/{id}`, per-doc lists, the summary (aggregates only the view).

### "Zero is a claim about an answer" (D-12 / SEED-248)
**Source:** `DocumentsFindBody.tsx:173-174` (`isZero`), `LibraryStatTiles.tsx:20,97-115` (`…` / `Not known yet` / `—`), `NavRow.tsx:40-42,247` (`count={undefined}` omits the slot), `DocumentChunksSection.tsx:85-114` (loading / error / empty are three different sentences).
**Apply to:** every Library number and list in UI-SPEC S1-S14.

### Realtime is a hint (D-v2.5-03)
**Source:** `useDocuments.ts:79-83` comment + `:87-89` (terminal-state refetch).
**Apply to:** D-08 — UPDATE merges on-page rows, INSERT/DELETE trigger a debounced refetch of page + summary; the background refetch is silent (no dim, no `aria-busy`).

### Grants: revoke from PUBLIC first, then grant back
**Source:** `206_retention_hold_hardening.sql:329-338`; `200_…sql:50-53` ("REVOKE from PUBLIC *and* anon, then grant back"); CLAUDE.md §Supabase MCP.
**Apply to:** migration 207 + the supplement mirror; prove with `has_table_privilege` rows in the VERIFY block and a live `anon` / service-role read.

### Source fences read code, not comments
**Source:** `frontend/src/lib/stripComments.testutil.ts`; backend docstrings that deliberately do not spell a fenced token (`documents.py:930-932`, `lib/api/documents.ts:8-10`).
**Apply to:** D-16 fence, `_ID_BATCH`-absent fence, any `?raw` count. ⚠ Prose in a new docblock that names a fenced literal (e.g. `listDocuments()`, `_ID_BATCH`) will trip or dilute the fence.

### Hot-file ledger rows before a PLAN names a file (G-5 gate)
**Source:** `docs/HOT-FILE-LEDGER.md` §"Scan list" (`:10989`), row format e.g. `:11040`:
```
| [`frontend/src/components/library/DocumentsPager.tsx`](docs/HOT-FILE-LEDGER.md#frontendsrccomponentslibrarydocumentspagertsx) | 3 / 2 / 112 (was `2 / 1 / 108`) | no (2 phases) | **271-04**: ONE optional `exact` prop ... |
```
plus a `### <path>` section in the same commit (`:18332` style). **Apply to:** the ten `[no-row]` files in RESEARCH fact 10 (`document_views.py`, `library.py`, `folder_utils.py`, `FolderDetail.tsx`, `LibraryStatTiles.tsx`, `ViewsTab.tsx`, `DocumentTablesSection.tsx`, `DocumentImagesSection.tsx`, `TakeoffSection.tsx`, new `useLibraryDocuments.ts`) — and any new hook / test-util file that a PLAN's `files_modified` names. Verify with `node scripts/check-hot-file-ledger.cjs --files …`.

### Local-DB lock + serialisation (worktree rule 4)
**Source:** memory `reference_local_db_lock_between_sessions.md`; `278-01-PLAN.md:118` (`set -C; echo 278-01 > …/agentic-rag-localdb.lock`, wait if it exists, never delete another session's lock).
**Apply to:** the seed, the 207 apply, every `tests/integration/test_284_*` run, the backend baseline, and the measurement runs.

---

## No Analog Found

| File | Role | Data Flow | Reason / what to use instead |
|---|---|---|---|
| `supabase/migrations/207_library_documents_view.sql` — the view body itself | migration | DDL | No `CREATE VIEW` / `security_invoker` in any migration. Use RESEARCH Pattern 1 (`284-RESEARCH.md:434-474`); wrap it in 206's header / grants / VERIFY shape. Assumption A1 (syntax on PG17) is proven by the VERIFY row + the live leak test. |
| `backend/tests/unit/test_284_request_recorder.py` — recording supabase-py's PostgREST traffic | test | — | No test records PostgREST requests through the shared httpx transport. Compose `dependencies._shared_httpx` (seam) + `test_mcp_egress_hardening.py:185-209` (MockTransport, assert on `httpx.Request`) + RESEARCH `violations()` (`284-RESEARCH.md:635-669`). |
| `DocumentChunksSection.tsx` sentinel — IntersectionObserver with `root` = a scroll region | component | paged append | Only page-level observers exist (`docs/components/TocPill.tsx`, `landing/components/HeroPromo.tsx` / `HeroSection.tsx`), none inside an app scroll region and none with a test. Copy TocPill's jsdom guard + `disconnect()` cleanup; stub IntersectionObserver per-suite. |

---

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/`, `backend/app/models/`, `backend/app/dependencies.py`, `backend/tests/unit/`, `backend/tests/integration/`, `backend/scripts/`, `scripts/`, `supabase/migrations/`, `frontend/src/hooks/`, `frontend/src/lib/api/`, `frontend/src/components/{library,ingestion,metadata,relationships,retention,layout}/`, `frontend/src/pages/`, `frontend/src/test-utils/`, `docs/public/api/concepts/`, `docs/HOT-FILE-LEDGER.md`, `.planning/milestones/v4.5-phases/275-retention-legal-hold/`.
**Files scanned:** ~60 (36 read in part or whole).
**Pattern extraction date:** 2026-10-16.
