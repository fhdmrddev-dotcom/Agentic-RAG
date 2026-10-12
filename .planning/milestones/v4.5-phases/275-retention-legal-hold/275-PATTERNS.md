# Phase 275: Retention & Legal Hold - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 52 new or modified files (from CONTEXT D-01..D-38, RESEARCH §Recommended Project Structure + Plan Breakdown, UI-SPEC S1-S10)
**Analogs found:** 49 / 52 (3 have only a partial analog; see §No Analog Found)

All line numbers were read at HEAD `d82a271e4` on 2026-10-12. Re-derive them before editing a hot file.

---

## File Classification

### Database (plan 275-01)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/204_retention_and_legal_hold.sql` | migration (tables + RLS + triggers + DEFINER fn + audit CHECK) | CRUD / event-driven (triggers) | `202_message_artifacts.sql` (table + trigger + REVOKE/GRANT + VERIFY), `116_connector_connections.sql:118-131` (org:manage RLS), `170_documents_source_state.sql:122-136` (audit CHECK rebuild) | exact (composite) |
| `supabase/migrations/205_retrievable_predicate.sql` | migration (generated column + RPC redefinition + restrictive policies) | transform (read predicate) | `200_filtered_retrieval_document_scope.sql` (RPC bodies, plan pin, REVOKE/GRANT, VERIFY), `012_query_documents_fn.sql` (query_user_documents body) | exact |
| `supabase/full-schema.sql` | generated artifact | — | `bash scripts/regenerate-full-schema.sh` (never hand-edit) | n/a |
| `backend/app/services/retention/hold_guard.py` | service (guard) | request-response | `backend/app/services/thread_workspace_cleanup.py` (thin seam called once from a hot file) | role-match |
| `backend/app/services/audit_service.py` (VALID_ACTION_TYPES) | config (enum) | — | itself `:13-28` + mig 170 `:124-136` | exact |
| `backend/tests/integration/test_275_hold_triggers.py`, `test_275_retrievable.py`, `test_275_policy_rls.py`, `test_275_disposition.py` | test (live DB) | CRUD | `backend/tests/integration/test_272_scope_rls.py` (seed + `finally` cleanup + positive control), `test_272_rpc_document_scope.py` (`EXACT_BRANCH_SQL` holder) | exact |
| `backend/tests/unit/test_275_migration_204_shape.py`, `test_275_migration_205_shape.py` | test (text fence) | — | `backend/tests/unit/test_274_migration_203_shape.py` | exact |

### Backend seams (plan 275-02)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/api/documents.py` (delete paths 1+2: guard call + reorder) | controller | request-response | `backend/app/api/threads.py:1444-1452` (collect → delete → remove bytes, 274 D-08) | exact |
| `backend/app/api/folders.py` (path 3: guard, refuse whole, reorder, audit row) | controller | request-response | same as above + `org.py:585-595` (audit row with explicit org) | exact |
| `backend/app/api/sources.py` (paths 4+5: guard, stop swallowing) | controller | request-response | same as above | role-match |
| `backend/app/services/retrieval_scope.py` | service (predicate data) | transform | itself `:72-83`, `:149-160`, `:323-325` | exact (edit in place) |
| `backend/app/services/expert_scope.py` | service | CRUD (read) | itself `:162`, `:185-193` | exact (edit in place) |
| `backend/app/services/retention/agent_wall.py` | utility (refusal helper) | request-response | `tool_dispatcher._doc_out_of_scope` `:293-300` + `_document_folder_ids` `:284-290` | exact |
| `backend/app/services/tool_dispatcher.py` (wall calls) | service | request-response | itself `:355-360`, `:394-401`, `:1077` | exact (edit in place) |
| `backend/app/services/retrieval_documents.py` (or wall call) | service | CRUD (read) | `retrieval_scope._builder` `.eq` chain | role-match |
| `backend/app/api/kb.py` (ls/tree/glob filter) | controller | CRUD (read) | itself `:66-98` | exact (edit in place) |
| `backend/app/services/document_search_service.py` | service | CRUD (read) | itself `_apply_version` `:214-217`, `structure()` `:440-448` | exact (edit in place) |
| `backend/app/models/document_search.py` | model | — | itself `DocumentSearchRequest` `:148-162` | exact |
| `backend/app/models/document.py` | model | — | itself `:78-88` (Phase 270 defaulted optional fields) | exact |
| `backend/tests/unit/test_275_delete_paths.py` | test (stubbed builders) | request-response | `backend/tests/unit/test_274_delete_thread_cleanup.py` | exact |
| `backend/tests/unit/test_275_agent_wall.py` | test | request-response | `test_274_delete_thread_cleanup.py` recording `_Query` stub | role-match |
| Fence retirements: `test_272_scope_seam.py:33-34`, `test_272_scope_resolver.py:146`, `test_267_scope_preview.py:69`, `test_272_pure_move.py`, `integration/test_272_rpc_document_scope.py:54-66` | test | — | the SEED-177 "retire on purpose, reason in the body" rule | n/a |

### Retention engine + API (plan 275-03)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/retention/evaluate.py` | service (PURE) | transform | `backend/app/services/sources/health_verdict.py` (frozen dataclass verdict, "NO I/O" fenced over source) | exact |
| `backend/app/services/retention/periods.py` | utility (pure) | transform | `health_verdict.py` (pure, stdlib only) | role-match |
| `backend/app/services/retention/load.py` | service (fail-closed loader) | batch read | `document_search_service._fetch_all` `:229-251` (`SearchTruncatedError`) | exact |
| `backend/app/services/retention/disposition.py` | service | CRUD (asyncpg TX) | `db/watches.claim_due_watches` `:220-256` (`pool.acquire()` + `con.transaction()`) + `threads.py:1444-1452` (bytes last) | role-match |
| `backend/app/services/retention/sweep_service.py` | service (daemon) | event-driven (poll) | `backend/app/services/watch_service.py:85-174` (`WatchService.start/stop/_poll_loop/tick`) | exact |
| `backend/app/db/retention.py` | data access | batch (claim + lease) | `backend/app/db/watches.py:203-256` `claim_due_watches` | exact |
| `backend/app/models/retention.py` | model | — | `backend/app/models/document_search.py:148-162` (`extra="forbid"`) | exact |
| `backend/app/api/retention.py` | controller (org-admin) | request-response | `backend/app/api/org.py` (router `:102-105`, `require_org_manage` `:202-220`, write + audit `:555-596`) | exact |
| `backend/app/main.py` (lifespan block + `include_router`) | config | — | itself `:581-604` (start) + `:667-673` (stop) + `:893-894` (router) | exact |
| `backend/app/config.py` (`retention_sweep_enabled`) | config | — | itself `:1409-1416` (`watch_process_enabled`) | exact |
| `backend/.env.example`, `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` | config (deploy parity) | — | the `WATCH_PROCESS_ENABLED` stanza in each (`:351`, `:273-274`, `:167-172`, `:104-108`) | exact |
| `backend/tests/unit/test_275_evaluate.py`, `test_275_periods.py`, `test_275_sweep.py` | test (pure) | transform | `backend/tests/unit/services/test_source_health_verdict.py` (`:281-295` no-I/O + frozen fences) | exact |
| `backend/tests/unit/test_275_retention_api.py` | test (router + perms) | request-response | `backend/tests/unit/test_190_connectors_api.py:100-160` (probe app, `_install_perms`, `_forbid_the_service`) | exact |

### Frontend (plan 275-04)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/lib/api/retention.ts` | api client | request-response | `frontend/src/lib/api/attachments.ts:64-129` (`PromoteError` + `refusalOf` + `getAuthHeaders`) | exact |
| `frontend/src/lib/api/documents.ts` (`deleteDocument`, `deleteFolder` throw a typed refusal) | api client | request-response | `attachments.ts:78-86` `refusalOf` | exact |
| `frontend/src/lib/api/sources.ts` (`purgeWatchFiles` refusal) | api client | request-response | same | exact |
| `retention/RetentionTab.tsx` (S1, self-fetching) | component (container) | request-response | `frontend/src/components/org/OrgExpertsTab.tsx:27-56` (self-owned fetch) + `OrgAdminShell.tsx:150-213` (alive guard, honest degrade) | exact |
| `retention/RetentionPolicyEditor.tsx`, `RetentionPreview.tsx` (S2) | component (form) | request-response | `OrgExpertsTab.tsx:100-116` (in-place editor swap, not a modal) | role-match |
| `retention/LegalHoldsList.tsx`, `LegalHoldDialog.tsx`, `ReleaseHoldDialog.tsx` (S3) | component | CRUD | `frontend/src/components/attachments/SaveToLibraryDialog.tsx` (dialog, inline refusal, disabled until picked) | role-match |
| `retention/DeleteBatchCard.tsx`, `ReviewBatchCard.tsx` (S4) | component | CRUD | `SaveToLibraryDialog.tsx` (confirm gating) | partial |
| `retention/RetentionHistory.tsx` (S5) | component (list) | request-response | `frontend/src/components/org/OrgAuditTab.tsx` (pager idiom) | role-match |
| `retention/RetentionChip.tsx` | component (presentational) | — | `frontend/src/components/org/StatusChip.tsx:29-64` | exact |
| `retention/RetentionFolderLine.tsx` (S7) | component (presentational) | — | `frontend/src/components/metadata/DocumentFileFacts.tsx` (pure function of props, no fetch) | role-match |
| `retention/RetentionSection.tsx` (S8) | component (panel section body) | — / request-response (un-archive) | `DocumentFileFacts.tsx:1-50` | role-match |
| `retention/retentionCopy.ts` + `__tests__/retentionCopy.test.ts` | config (copy port) + test | — | `frontend/src/components/attachments/saveToLibraryCopy.ts` + `__tests__/saveToLibraryCopy.test.ts` | exact (shape differs: see note) |
| `frontend/src/components/org/OrgAdminShell.tsx` | component (shell) | — | itself `:104-109` (flip) + `:398-399` (`<OrgExpertsTab />` branch) | exact |
| `frontend/src/components/org/OrgAdminShell.test.tsx` | test (fence retirement) | — | itself `:86-91`, `:192-204` | exact |
| `frontend/src/components/ingestion/DocumentRow.tsx` (one chip mount) | component | — | itself `:444-446` (`<ClassificationRowChip … />` mount) | exact |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` (one section) | component | — | itself `:333-335` (`<PanelSection title="File" defaultOpen>`) | exact |
| `frontend/src/pages/LibraryPage.tsx` (folder line under `FolderDetail`, archived-hidden line, shared include-archived state) | component (page) | — | itself `:940` `documentsLead`, `:995` `<FolderDetail` | exact |
| `frontend/src/components/ingestion/DocumentList.tsx` (refusal mode, hidden count) | component | request-response | itself `:120-136` `handleDelete` | exact |
| `frontend/src/components/ingestion/FolderNode.tsx` (refusal replaces confirm) | component | request-response | itself `:204-229` inline delete confirm | exact |
| `frontend/src/components/sources/WatchedFoldersSection.tsx` (purge refusal) | component | request-response | itself `:339-357` `handlePurge` | exact |
| `frontend/src/components/library/find/FindQuickAdd.tsx` (Include archived chip) | component | — | itself `:311-322` Version `SetChip` + `:332-358` | exact |
| `frontend/src/pages/findState.ts` (`include_archived` action + request field) | store (reducer) | transform | itself `:169`, `:207-208` (`SET_VERSION`), `:321` (`toSearchRequest`) | exact |
| `frontend/src/types/index.ts` (`archived_at`, `archived_policy_id`, `source_state` on `Document`) | model | — | itself `:662-669` (Phase 270 optional fields) | exact |
| `scripts/vitest-count-gate.cjs` (TARGETS dir + BASELINE pins) | config (gate) | — | itself `:4178-4197` (BASELINE block) + `:6120-6124` (TARGETS dir entry) | exact |
| `frontend/src/components/retention/__tests__/*` | test | — | `frontend/src/components/attachments/__tests__/SaveToLibraryDialog.test.tsx:1-40` (`vi.mock` partial actual) | exact |

---

## Pattern Assignments

### `supabase/migrations/204_retention_and_legal_hold.sql` (migration, triggers + RLS)

**Analogs:** `supabase/migrations/202_message_artifacts.sql` (whole-file skeleton), `116_connector_connections.sql:118-131` (org:manage write wall), `170_documents_source_state.sql:122-136` (audit CHECK), `full-schema.sql:273-289` (`folder_is_org_shared`, recursive DEFINER helper).

**File header + apply discipline** (copy from 202:50-57, 203:27-32):
```sql
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`. Idempotent: safe to paste twice.
-- Then: bash scripts/regenerate-full-schema.sh (no --reset).
-- ⚠ PRODUCTION: apply BEFORE the backend that writes this table deploys, then run
--   get_advisors(security) — a deploy-parity item.
BEGIN;
```

**Table + REVOKE ALL incl. service_role, then grant back** (202:155-167). Note the measured trap at 202:159-161: Supabase default privileges give `service_role` ALL on a new table, and GRANT never removes, so revoke it explicitly:
```sql
ALTER TABLE public.message_artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.message_artifacts FROM PUBLIC;
REVOKE ALL ON TABLE public.message_artifacts FROM anon;
REVOKE ALL ON TABLE public.message_artifacts FROM authenticated;
REVOKE ALL ON TABLE public.message_artifacts FROM service_role;
GRANT SELECT ON TABLE public.message_artifacts TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.message_artifacts TO service_role;
```
Use this exactly for `retention_receipts` (no UPDATE grant anywhere: a receipt is immutable) and `retention_sweeps` (service_role only).

**org:manage RLS wall** (116:118-131), for `retention_policies`, `legal_holds`, `legal_hold_documents`, `legal_hold_folders`, `retention_receipts` (SELECT only):
```sql
DROP POLICY IF EXISTS connector_connections_insert ON public.connector_connections;
CREATE POLICY connector_connections_insert ON public.connector_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));
CREATE POLICY connector_connections_update ON public.connector_connections
  FOR UPDATE TO authenticated
  USING (public.current_user_has_permission(org_id, 'org:manage'))
  WITH CHECK (public.current_user_has_permission(org_id, 'org:manage') AND org_id IN (SELECT public.current_user_org_ids()));
```
Differences for 275: SELECT is **also** manage-only on holds and receipts (D-17: members never read matter names), unlike 116's org-wide read. Holds have **no DELETE policy** (released, never deleted).

**Trigger + trigger-function grants** (202:125-152). Copy the positive form (`IF <ok> THEN RETURN …; END IF; RAISE …`) so a NULL condition falls through to the refusal, and the four-line trigger-function REVOKE:
```sql
    RAISE EXCEPTION 'message_artifacts rows are immutable once shown (D-08)'
        USING ERRCODE = 'insufficient_privilege';
...
REVOKE EXECUTE ON FUNCTION public.message_artifacts_immutable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.message_artifacts_immutable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.message_artifacts_immutable() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.message_artifacts_immutable() TO service_role;
```
275 differences: hold triggers use `ERRCODE = 'PT409'` (RESEARCH Code Examples §"The hold trigger"), the message names the document id only (Pitfall 5), and the functions are `SECURITY DEFINER SET search_path TO ''`.

**Recursive ancestor walk** (`full-schema.sql:273-289`, `folder_is_org_shared`), the shape for the folder arm of `retention_held_documents`:
```sql
CREATE FUNCTION public.folder_is_org_shared(p_folder_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_org_shared FROM public.folders WHERE id = p_folder_id
    UNION ALL
    SELECT f.id, f.parent_id, f.is_org_shared FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_org_shared), false) FROM ancestors;
$$;
```
⚠ This analog has **no cycle bound**. RESEARCH Pattern 3 requires "cycle-bounded". Add `CYCLE id SET is_cycle USING path` (PG14+) or a depth column with a cap. Do not copy the bare walk.

**Audit CHECK rebuild** (170:123-136): drop and re-add the whole list, keeping every existing literal:
```sql
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- 11 legacy actions
    'document.upload', 'document.delete', ...,
    -- 3 Connector watch actions (Phase 234 / LIB-08)
    'connector.watch.create', 'connector.watch.delete', 'connector.watch.sync'
  ]::text[]));
```
Append the RESEARCH Pattern 9 types (`retention.policy.create/update/delete`, `retention.hold.create/update/release`, `retention.disposition.confirm`, `retention.document.unarchive`, `retention.document.keep`, `folder.delete`).

**VERIFY block** (202:179-214): copy the `with checks(what, ok) as (values …) select case when ok then 'PASS' else '*** FAIL ***' end` shape. Required rows: RLS on every new table; anon has no privilege on any; `authenticated` lacks TRUNCATE on `documents`/`folders`; each trigger present and not `tgisinternal`; anon cannot EXECUTE `retention_held_documents`.

---

### `supabase/migrations/205_retrievable_predicate.sql` (migration, RPC redefinition)

**Analog:** `supabase/migrations/200_filtered_retrieval_document_scope.sql`.

**Function header with BOTH SET clauses** (200:115-131). `test_272_review_fixes.py:630` fails any definition from 200 on without the pin:
```sql
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding public.vector, match_user_id uuid, match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3, metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[], p_embedding_model text DEFAULT NULL::text,
  p_document_ids uuid[] DEFAULT NULL::uuid[], p_exact_max_chunks integer DEFAULT NULL::integer
)
 RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET plan_cache_mode TO 'force_custom_plan'
```
Same signature, so no `DROP FUNCTION` is needed (200's step 2 dropped *old* signatures; 205 must not drop the current ones).

**The three lines to swap** (each becomes `AND d.retrievable`):
- 200:168 exact branch: `AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')`
- 200:191 index branch: same
- 200:238 `keyword_search_chunks`: same

Copy every other predicate verbatim (org gate, visibility, `is_latest`, metadata, folder scope, embedding model, document set).

**REVOKE/GRANT tail** (200:249-258), re-asserted even though `CREATE OR REPLACE` keeps the ACL:
```sql
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) TO service_role;
```

**`query_user_documents` body** (`012_query_documents_fn.sql:5-28`, identical in `full-schema.sql:511-533`). Keep it INVOKER; insert one `PERFORM set_config('app.agent_read', 'on', true);` before the `EXECUTE`. ⚠ Its only grant today is `GRANT EXECUTE … TO authenticated` (012:31 / full-schema:9243) with **no PUBLIC revoke**. Redefinition must add `REVOKE … FROM PUBLIC, anon` and re-grant `authenticated` (CLAUDE.md PUBLIC trap).

**Statistics step:** `ANALYZE public.documents;` directly after the column add (RESEARCH M-1, Pitfall 1). It is allowed inside `BEGIN … COMMIT`.

**Fence that must be updated in the same plan:** `backend/tests/integration/test_272_rpc_document_scope.py:54` holds the exact-branch SQL verbatim and asserts it at `:286`. Update the string to `AND d.retrievable`.

---

### `backend/tests/integration/test_275_*.py` (live DB tests)

**Analog:** `backend/tests/integration/test_272_scope_rls.py`.

**Imports + skip guard** (272:21-32):
```python
from uuid import UUID, uuid4
import pytest
from tests.integration._271_gotrue_users import _admin, require_gotrue
from tests.integration._rls_harness import requires_pg
from tests.integration.test_163_rls_documents import _add_comember, _drop_user

pytestmark = requires_pg
```

**Seed helpers** (272:38-56). Pass the dict for jsonb (the `pg_pool` fixture registers a jsonb codec):
```python
async def _doc(pool, *, owner, org, folder, name, metadata):
    did = uuid4()
    await pool.execute(
        "INSERT INTO public.documents (id, user_id, org_id, folder_id, filename, file_path, file_size, "
        "mime_type, status, is_latest, version_number, metadata) "
        "VALUES ($1,$2,$3,$4,$5,$6,100,'text/markdown','completed',true,1,$7::jsonb)",
        did, UUID(owner), UUID(org), folder, name, f"{owner}/{did}.md", metadata,
    )
    return str(did)
```

**Fixture with `finally` cleanup + single-org assertion** (272:69-131). Uses `pg_pool`, `two_orgs_two_users` (`conftest.py:74-199`). ⚠ For 275, cleanup must **release holds before deleting documents**, or the new trigger refuses the cleanup DELETE and leaks rows into the dev DB.

**Running as a user under RLS** (`_rls_harness.py:78-105`): `open_user_conn(pool, uid)` / `as_user_asyncpg(pool, uid, sql, *args)` / `as_user_fetchval`. Use these for "a member's direct read of `legal_holds` returns nothing" and for "`query_user_documents` cannot see archived chunks".

**Positive control rule** (272:9-12): every "absent" assertion has a sibling case where the same call returns the row, so "absent" cannot mean "query broken". One case per `source_state` value plus archived, on both RPC arms (D-21).

---

### `backend/tests/unit/test_275_migration_20{4,5}_shape.py` (text fences)

**Analog:** `backend/tests/unit/test_274_migration_203_shape.py:20-45`:
```python
REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"

def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("203_*.sql"))
    assert len(matches) == 1, matches
    return matches[0]

def _strip_comments(sql: str) -> str:
    out = []
    for line in sql.splitlines():
        idx = line.find("--")
        ...
```
Assert over comment-stripped text: `ERRCODE = 'PT409'`; no hold-name column interpolated into a `RAISE`; `REVOKE … FROM PUBLIC` before every `GRANT EXECUTE`; `ANALYZE public.documents` follows the column add; each plan record names its plant ("PLANT: drop X → red").

---

### `backend/app/services/retention/hold_guard.py` (guard, one module called per path)

**Analog:** `backend/app/services/thread_workspace_cleanup.py` (Phase 274 D-08: a thin module, the hot file gains only call lines).

**Module docstring shape** (`thread_workspace_cleanup.py:1-25`): name the contract, the client used, and what it never does. Header line to mirror:
```python
"""Phase 274 (ATT-01 / D-08) — a deleted thread takes its attachment BYTES with it.

Two thin async-service functions, mirroring the ``template_service.py`` thin-seam shape (all
logic here; main.py / threads.py gain only delegating call-throughs so the G-5 hot file
threads.py never grows inline query/Storage logic):
```

**Imports + async wrapper** (`thread_workspace_cleanup.py:28-36`):
```python
from __future__ import annotations
import logging
from starlette.concurrency import run_in_threadpool
from app.utils.db import aexec
logger = logging.getLogger(__name__)
```

**Call site in the hot file** (`threads.py:88`, `:1444`, `:1452`): one import line plus one call per step. The guard is called **before** any storage removal:
```python
from app.services.thread_workspace_cleanup import collect_thread_workspace_paths, remove_workspace_paths  # 274 D-08
...
workspace_paths = await collect_thread_workspace_paths(supabase, thread_id, current_user["id"])
...
await remove_workspace_paths(supabase, workspace_paths, thread_id=thread_id)  # T-274-04
```
275 difference: the guard **raises** (`HoldRefusal` → HTTP 409). The 274 helpers never raise. Map PostgREST `APIError.code == 'PT409'` and asyncpg `sqlstate == 'PT409'` to the same 409 in this module, so the call sites carry no `except` branch (D-32).

---

### `backend/app/api/documents.py` delete paths 1 and 2 (controller, reorder only)

**Current order (the defect, Pitfall 3):**
- `scope=all`: siblings read at `:1837-1847`, **storage loop `:1849-1855`**, row delete `:1859-1861`.
- `scope=version`: **storage remove `:1866-1869`**, row delete `:1871`, sibling promote `:1873-1892`.
- audit at `:1894-1904` (service-role `write_audit_entry` BackgroundTask, keep as-is).

**Target order:** guard → row delete → storage. Copy the 274 sequence (`threads.py:1444-1452`). The existing `try/except: pass` around storage stays as the D-10 swallow but moves **after** the delete. No new `if`: D-32 allows guard calls and a reorder only.

### `backend/app/api/folders.py` path 3

Current `:133-169`: BFS of subfolders `:141-148`, doc read `:151-156`, **storage loop `:159-163`**, docs delete `:164-166`, folder delete `:169`. Imports at `:1-6` carry no audit import. Add the guard over all `doc_ids` (plus the covered-folder check) before `:159`, then docs delete → folder delete → storage. For the `folder.delete` audit row, copy `org.py:585-595` (explicit `org_id`). Ledger row owed (RESEARCH Q8: 11/9/233, FIRES).

### `backend/app/api/sources.py` paths 4 and 5

- Path 4 `:324-336`: `except Exception as err: logger.warning(...)`, then the watch is deleted at `:338`.
- Path 5 `:466-476`: same swallow, and `purged_count = len(doc_ids)` at `:474` is reported even when the delete raised; items are deleted at `:478-483` anyway.

Both: call the guard before `:327` / `:466`, and let a PT409 propagate as 409 (Pitfall 4). Both already wrap supabase-py in `run_in_threadpool(lambda: …)`; keep that.

---

### `backend/app/services/retrieval_scope.py` + `expert_scope.py` (predicate as data)

**`DEFAULT_PREDICATES`** (`retrieval_scope.py:72-83`). Rename the middle entry only; the dataclass at `:54-66` is unchanged:
```python
    # mig 170:74 / :112 — `AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')`.
    # Enforced in the RPC; the resolver applies it in step 1 for COUNT parity in 272-03.
    RetrievalPredicate("not_source_disconnected", None, True),
```
→ `RetrievalPredicate("retrievable", None, True)`, comment pointing at mig 205.

**Three literal copies to replace with `RETRIEVABLE_COLUMN`:**
- `retrieval_scope.py:151` and `:157` (`_STORED_SPELLINGS_SQL`, `_TOP_TYPES_SQL`): `WHERE is_latest AND retrievable …`
- `retrieval_scope.py:323-325` (`_builder`): `.or_("source_state.is.null,source_state.neq.source_disconnected")` → `.eq(RETRIEVABLE_COLUMN, True)`
- `expert_scope.py:162` constant `_NOT_SOURCE_DISCONNECTED` and its use at `:190` → import `RETRIEVABLE_COLUMN` and `.eq(RETRIEVABLE_COLUMN, True)`

`grep -rn source_disconnected backend/app` at HEAD returns exactly these sites plus `api/connectors.py:574-615` (the *writer* of the state, which stays).

---

### `backend/app/services/retention/agent_wall.py` + `tool_dispatcher.py` call sites

**Analog:** `tool_dispatcher._doc_out_of_scope` (`:293-300`) over the batched read `_document_folder_ids` (`:284-290`):
```python
    resp = await aexec(
        ctx.supabase.table("documents").select("id, folder_id").in_("id", list(doc_ids))
    )
    return {str(r["id"]): (str(r["folder_id"]) if r.get("folder_id") else None) for r in (resp.data or [])}


async def _doc_out_of_scope(ctx: ToolContext, doc_id: str) -> bool:
    scope = _scope_set(ctx)
    if scope is None:
        return False
    folders = await _document_folder_ids(ctx, [doc_id])
    if doc_id not in folders:
        return False  # unknown to the caller — the normal path reports not-found
    return folders[doc_id] not in scope
```
`unretrievable(supabase, ids) -> set[str]` follows the same shape with `select("id, retrievable")`. An unknown id returns "not refused" so the normal not-found path speaks (same rule as `:298-299`).

**Call sites, one line each beside the existing folder wall:**
- `_handle_read_document` `:355-360`:
  ```python
      if await _doc_out_of_scope(ctx, str(args["document_id"])):
          return ToolResult(result=json.dumps({
              "error": f"Document {args['document_id']} {_OUT_OF_SCOPE}.",
              "error_kind": "out_of_scope",
          }))
  ```
- `_fetch_owned_document_bytes` `:394-401` (fetch_document_file and attach_skill_file both pass through it)
- `analyze_document` `:1077`

**Listing tools:** `_handle_ls` `:312-321` and `_handle_glob` `:343-352` already post-filter `result["documents"]` / `result["matches"]`; filter there, or at the `kb.py` reads (`:66-71`, `:83-98`, glob `:342-351`) with `.eq(RETRIEVABLE_COLUMN, True)`. `/kb/*` has no frontend caller (RESEARCH Q2), so the `kb.py` edit is agent-only.

---

### `backend/app/services/document_search_service.py` + `models/document_search.py` (Find)

**Request model** (`models/document_search.py:148-162`): add `include_archived: bool = False` beside `version: VersionState = "latest"`. `model_config = ConfigDict(extra="forbid")` stays (Pitfall 13: backend deploys first).

**Filter helper** (copy `_apply_version` `:214-217`):
```python
def _apply_version(q, version: str):
    return q.eq("is_latest", version != "older")
```
Add `_apply_archived(q, include_archived)` → `q if include_archived else q.is_("archived_at", "null")`, and one line in `structure()` `:440-448` after `_apply_version`.

**Fail-closed reader for the retention loader** (`_fetch_all` `:229-251`). Copy it into `retention/load.py`, raising `IncompleteEvaluation` instead of `SearchTruncatedError`:
```python
    first = await aexec(build(True).order("id").range(0, _PAGE - 1))
    rows = list(first.data or [])
    total = getattr(first, "count", None)
    if not isinstance(total, int):
        return rows
    while len(rows) < total:
        page = await aexec(build(False).order("id").range(len(rows), len(rows) + _PAGE - 1))
        ...
    if len(rows) < total:
        raise SearchTruncatedError()
```
⚠ The `isinstance(total, int)` early return (`:240-241`) exists for test doubles. In the retention loader a missing count must **raise** (SRC-06), not return the partial page.

---

### `backend/app/services/retention/evaluate.py` + `periods.py` (pure)

**Analog:** `backend/app/services/sources/health_verdict.py`.

**Docstring sections** (`:1-41`): "THE RULE LIVES HERE AND NOWHERE ELSE", the decisions in force, and "WHAT THIS MODULE MAY NOT DO: NO I/O".

**Frozen dataclass result** (`:67-86`), one commented field per fact:
```python
@dataclass(frozen=True)
class Verdict:
    """What the server is willing to say about one source, from its stored history."""

    #: The debounce rule has fired: ...
    stopped: bool
    #: The named cause of the CURRENT failure streak, ...
    cause: Cause | None
```

**Fail-closed polarity constant** (`:55-59`): an unknown value counts as the unsafe case. The retention equivalent: an unknown `source_state` is non-retrievable (handled by the `= 'live'` column), and an unknown policy action yields `UNDECIDABLE`.

**Tests** (`tests/unit/services/test_source_health_verdict.py:281-295`), copied verbatim with the module swapped:
```python
def test_verdict_module_imports_nothing_from_the_db_or_api_layers():
    import inspect
    from app.services.sources import health_verdict
    src = inspect.getsource(health_verdict)
    for forbidden in ("app.db", "app.api", "asyncpg", "supabase", "app.dependencies"):
        assert forbidden not in src, f"health_verdict must not reach {forbidden}"

def test_verdict_is_frozen():
    v = verdict_for_runs([])
    with pytest.raises(Exception):
        v.stopped = True  # type: ignore[misc]
```
**Fixture source:** the sketch's own `evaluate()` and 24-document worked example live in `.planning/sketches/275-retention-legal-hold/index.html` (`policyRow` at `:294`, `retentionFor` at `:404`). Port the Halden & Co. fixture from there ("computed, not faked").

---

### `backend/app/db/retention.py` (claim + lease)

**Analog:** `backend/app/db/watches.py:203-256`.

**Module docstring invariants** (`watches.py:1-13`): copy the three-invariant shape (SKIP LOCKED inside `con.transaction()`; explicit org predicates; the poller is the sole caller without identity).

**Claim** (`:203-256`):
```python
async def claim_due_watches(pool: asyncpg.Pool, *, limit: int = 10, lease_seconds: int = 600, now: Any = None) -> list[dict]:
    claimed: list[dict] = []
    async with pool.acquire() as con:
        async with con.transaction():
            due = await con.fetch(
                f"""
                SELECT {_WATCH_CLAIM_COLUMNS}
                FROM connector_watches
                WHERE is_active = true
                  AND next_run_at <= COALESCE($2::timestamptz, now())
                  AND (leased_until IS NULL OR leased_until < COALESCE($2::timestamptz, now()))
                ORDER BY next_run_at
                LIMIT $1
                FOR UPDATE SKIP LOCKED
                """,
                limit, now,
            )
            for row in due:
                ...
                await con.execute(
                    """
                    UPDATE connector_watches
                    SET leased_until = now() + ($2 || ' seconds')::interval,
                        next_run_at = now() + ($3 || ' minutes')::interval,
                        last_run_at = now(),
                        last_status = 'running'
                    WHERE id = $1
                    """, wid, str(lease_seconds), str(interval_min),
                )
```
275 difference: `next_run_at` advances to the next 02:00 UTC (a code constant, A5), not `now() + interval`. Keep the `now` parameter: tests use it to claim deterministically.

**Release:** `release_watch` (`:259-…`) writes the terminal outcome in one place so every arm records it ("a fifth arm cannot forget"). Mirror it as `release_retention_sweep(pool, org_id, *, status, error, counts)`.

---

### `backend/app/services/retention/sweep_service.py` (daemon)

**Analog:** `backend/app/services/watch_service.py:85-174`.

**Class skeleton** (`:85-133`):
```python
class WatchService:
    def __init__(self, pool: asyncpg.Pool, settings: Settings | None = None, supabase: Client | None = None) -> None:
        self.pool = pool
        self.settings = settings or default_settings
        self._supabase = supabase
        self._running = False
        self._poll_task: asyncio.Task | None = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._poll_task = asyncio.create_task(self._poll_loop())

    def stop(self) -> None:
        self._running = False
        if self._poll_task and not self._poll_task.done():
            self._poll_task.cancel()

    async def _poll_loop(self) -> None:
        interval = getattr(self.settings, "watch_poll_interval_seconds", 60)
        while self._running:
            try:
                await self.tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Unexpected error in WatchService poll loop: %s", e)
            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break
```
**Per-item isolation** (`tick`, `:135-174`): claim → for each claimed row, `try` the work, and on any exception call the release with `status="failed"`. For retention, the failed arm also covers `IncompleteEvaluation` and writes `last_status='incomplete'` plus a `sweep_incomplete` receipt. **Dispose nothing** on that path.

⛔ Do not import or edit `scheduler_service.py` (D-31).

---

### `backend/app/main.py` + `backend/app/config.py` (flag-gated daemon)

**Lifespan start** (`main.py:581-604`):
```python
    # Phase 234 (LIB-08 / QUEUE-03) — the background connector watch loop.
    # Off by default, safe across multiple uvicorn workers with database-level claim exclusivity.
    _watch_service = None
    if not _setup_mode and getattr(settings, "watch_process_enabled", False):
        try:
            from app.services.watch_service import WatchService
            from app.dependencies import get_supabase

            _pg_pool = await get_pg_pool()
            _watch_service = WatchService(pool=_pg_pool, settings=settings, supabase=get_supabase())
            _watch_service.start()
            logger.info("Watch service started (poll every %ds, lease %ds)", ...)
        except Exception:
            logger.exception("Watch service failed to start (app continues)")
            _watch_service = None
    app_instance.state.watch_service = _watch_service
```
Place the retention block directly after `:604`.

**Lifespan stop** (`main.py:667-673`):
```python
    # Phase 234 — stop the watch service
    try:
        _ws = getattr(app_instance.state, "watch_service", None)
        if _ws is not None:
            _ws.stop()
    except Exception:  # noqa: BLE001
        logger.exception("Watch service stop failed at lifespan shutdown")
```

**Router registration** (`main.py:893-894`): one `app.include_router(retention.router)` line with a trailing phase comment, as `workspace_promote` has.

**Config** (`config.py:1409-1416`):
```python
    # ── Phase 234 (LIB-08 / QUEUE-03) — the background connector watch loop ─────────────
    # OFF BY DEFAULT, matching scheduler_process_enabled: makes outbound cloud provider calls
    # autonomously, so it must be explicitly enabled by the operator.
    watch_process_enabled: bool = False
```
Add only `retention_sweep_enabled: bool = False`. Poll interval, lease and the 02:00 hour stay **code constants** (RESEARCH Pattern 8, D-37: one env var).

**Deploy parity, same commit** (`scripts/check-deploy-drift.sh` enforces it). Add beside each existing watch stanza:
- `backend/.env.example:350-351`: `# ── Background connector watch loop … ──` / `WATCH_PROCESS_ENABLED=false`
- `deploy/onebox.env.example:273-274`: same two lines
- `docker-compose.prod.yml:105-107`: `WATCH_PROCESS_ENABLED: ${WATCH_PROCESS_ENABLED:-false}` under the "listed here to self-document the knobs" comment
- `docs/OPERATOR.md:167-172`: the bullet "`WATCH_PROCESS_ENABLED` ships **`false`** by default. Set it to `true` to …". The retention bullet must add "enable only after reading a dry run" (D-29).

---

### `backend/app/api/retention.py` (org-admin router)

**Analog:** `backend/app/api/org.py`.

**Imports** (`org.py:29-48`):
```python
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from starlette.concurrency import run_in_threadpool
from supabase import Client

import app.dependencies as deps
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_service_role_supabase,
    get_user_pg_connection,
    get_user_supabase_client,
    require_org_manage,
)
from app.services.audit_service import write_audit_entry
```

**Router: gates are per route, never router-level** (`org.py:94-105`, WR-01). Retention follows this too: `GET /retention/document-states` is member-readable, so a router-level `require_org_manage` would break it.
```python
router = APIRouter(prefix="/org", tags=["org"])
```

**Manage-gated read with service-role pool + explicit org bind** (`org.py:202-235`):
```python
@router.get("/members")
async def get_org_members(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _manage: dict = Depends(require_org_manage),
):
    active_org = deps._to_uuid(request.state.active_org)
    pool = await deps.get_pg_pool()  # service-role (BYPASSRLS): org-scoped ... behind require_org_manage
    count_row = await pool.fetchrow("SELECT count(*) AS n FROM public.org_members WHERE org_id = $1", active_org)
```
Every service-role statement binds `org_id = $active_org` (threat model "Admin of org A disposes org B's docs").

**Write + explicit-org audit row** (`org.py:555-596`):
```python
@router.delete("/invitations/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_org_invitation(
    request: Request,
    invite_id: str,
    current_user: dict = Depends(require_org_invite),
    audit_supabase: Client = Depends(get_user_supabase_client),
):
    active_org = deps._to_uuid(request.state.active_org)
    inv_uuid = deps._to_uuid(invite_id)
    if inv_uuid is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    async with get_user_pg_connection(request, current_user) as conn:
        row = await conn.fetchrow(
            "UPDATE public.org_invitations SET status = 'revoked', updated_at = now() "
            "WHERE id = $1 AND org_id = $2 AND status = 'pending' RETURNING id, email",
            inv_uuid, active_org,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    await write_audit_entry(
        user_id=current_user["id"],
        action_type=_INVITE_AUDIT_ACTION,
        metadata={"event": "invitation.revoke", "invitation_id": str(row["id"]), "email": row["email"]},
        supabase=audit_supabase,
        org_id=str(request.state.active_org),  # EXPLICIT active_org (T-167-23)
    )
```
Use the user-JWT connection for writes RLS can gate (policy and hold CRUD, so the RLS `WITH CHECK` is a second wall). Use the service-role asyncpg TX only for disposition (an admin may not own the documents) and un-archive (trigger 5 refuses `authenticated`).

**Member-safe hold names** (D-17): `_has_org_permission(request, current_user, org_id, "org:manage")` (`dependencies.py:878-896`) decides whether `hold_names` is included in `document-states`. It runs as the caller on a user-JWT connection; never evaluate it on the service pool.

**Preview token (Pattern 7).** HMAC shape: `oauth_service.py:206-209` (sign) and `:225-236` (`hmac.compare_digest` + `exp`). ⚠ See §Flags for planning, item 5: the obvious secret can be empty.

---

### `backend/tests/unit/test_275_retention_api.py` (router + permission tests)

**Analog:** `backend/tests/unit/test_190_connectors_api.py:100-160`.

**Probe app sharing the live override dict** (`:101-109`):
```python
@pytest.fixture
def router_client():
    probe = FastAPI()
    probe.include_router(connectors.router)
    probe.dependency_overrides = real_app.dependency_overrides
    return TestClient(probe)
```
**One permission seam patched** (`:116-125`): `monkeypatch.setattr("app.dependencies._has_org_permission", _fake)`.
**Member of the org** (`:139-142`): `monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool); mock_asyncpg_pool.set_fetchrow_result({"role": role})`.
**The write must never be reached** (`:145-158`, `_forbid_the_service`): patch every retention write verb to raise `AssertionError`, so a member 403 proves "never written", not just "status was 403". Record the plant: delete `Depends(require_org_manage)` → red (`:208`).

### `backend/tests/unit/test_275_delete_paths.py`

**Analog:** `backend/tests/unit/test_274_delete_thread_cleanup.py`. Its docstring (`:1-18`) states the order contract case by case. Its recording `_Query` builder (`:46-60`) logs every chained call, so a test can assert that storage `.remove` was **not** called when the guard (or a PT409 from `.delete()`) refused (Pitfall 3).

---

### `frontend/src/lib/api/retention.ts` + typed delete refusals

**Analog:** `frontend/src/lib/api/attachments.ts:64-129`.
```ts
export class PromoteError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "PromoteError"
    this.status = status
  }
}

async function refusalOf(res: Response, fallback: string): Promise<PromoteError> {
  const err = await res.json().catch(() => ({ detail: fallback }))
  const detail = (err as { detail?: unknown } | null)?.detail
  const message =
    typeof detail === "string"
      ? detail
      : (detail as { message?: string } | null)?.message ?? fallback
  return new PromoteError(res.status, message)
}

export async function promoteAttachment(threadId: string, fileId: string, folderId: string): Promise<PromoteResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${base(threadId)}/files/${fileId}/promote`, {
    method: "POST", headers, body: JSON.stringify({ folder_id: folderId }),
  })
  if (!res.ok) throw await refusalOf(res, "Couldn't save this file to the Library.")
  return res.json() as Promise<PromoteResult>
}
```
`getAuthHeaders()` (`_core.ts:272-280`) already injects `X-Org-Id`, which `get_active_org_id` validates.

⚠ **Required change, not optional:** `deleteDocument` (`lib/api/documents.ts:325-332`) throws `new Error("Failed to delete document")` and discards the status and body. `deleteFolder` (`:381`) and `purgeWatchFiles` (`lib/api/sources.ts:206`) need checking for the same. S10 refusal mode needs the 409 + detail, so these must throw a typed refusal (`refusalOf` shape). Then `DocumentList.handleDelete` (`:129-131`) can branch on `status === 409` instead of its generic `"Delete failed. Please try again."`.

---

### `frontend/src/components/org/OrgAdminShell.tsx` (minimal shell edit)

**Flip** (`:104-109`):
```ts
  {
    id: "retention",
    label: "Retention",
    locked: true,
    lockedDescription: "Data-retention controls are coming soon.",
  },
```
→ `{ id: "retention", label: "Retention", locked: false }`.

**One render branch, self-fetching leaf** (precedent `:398-399`):
```tsx
        ) : activeTab === "experts" ? (
          <OrgExpertsTab />
```
Add `activeTab === "retention" ? <RetentionTab onRecorded={…} />` before the final `LockedTab` fallthrough (`:435-436`). `OrgBand` already has `recordingPulse?: boolean` (`OrgBand.tsx:41`, `:53`, `:86`, `:93`). The shell gains one `recordingPulse` state, passed at `:344-350`, which is the only shell state UI-SPEC allows.

**Fence to retire on purpose:** `OrgAdminShell.test.tsx:86-91` lists `{ tab: "Retention", description: "Data-retention controls are coming soon." }` as a locked tab, and `:193` says "each of the 3 locked tabs". Update both in the same commit with a written reason (SEED-177).

### `retention/RetentionTab.tsx` (S1, owns its fetches)

**Analog:** `frontend/src/components/org/OrgExpertsTab.tsx:27-56`:
```tsx
export function OrgExpertsTab() {
  const [experts, setExperts] = useState<ExpertBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listExperts(true, false, true)
      setExperts(data)
    } catch (err: any) {
      setError(err.message || "Failed to load experts")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void fetchList() }, [fetchList])
```
Combine it with the shell's honest-degrade rule (`OrgAdminShell.tsx:150-167`): an `alive` ref, and a `catch` that **keeps last-known values** (UI-SPEC S1 "A read error keeps last-known values"). `OrgExpertsTab` clears to an error string instead, so do not copy that part.
**In-place editor swap** (`OrgExpertsTab.tsx:100-116`): `if (isCreating || editing) return <Editor onClose onSaved />`. That is the S2 "replaces the sub-tab body in place, not a modal" shape.
**Sub-tab strip:** the `role="tablist"` buttons at `OrgAdminShell.tsx:355-384`, restyled to the second-level underline (`border-b-2 border-primary`).

### `retention/RetentionChip.tsx` (S6)

**Analog:** `frontend/src/components/org/StatusChip.tsx:29-64`:
```tsx
export const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  muted: "border-border bg-muted/40 text-muted-foreground",
}
const BASE_CLASSES = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"

export function StatusChip({ tone, children, testId }: StatusChipProps) {
  return (
    <span data-testid={testId ?? "status-chip"} data-tone={tone} className={cn(BASE_CLASSES, CHIP_TONE_CLASS[tone])}>
      {children}
    </span>
  )
}
```
⚠ `BASE_CLASSES` is **not exported** (`:42`). UI-SPEC says RetentionChip is "built on StatusChip's BASE_CLASSES". Either add `export` (a one-word additive edit to `StatusChip.tsx`) or define the literal once in `RetentionChip` with a comment naming its source. Do not edit `CHIP_TONE_CLASS`. The retention tone map (`hold`, `archive`, `delete`, `review`, `undecidable`, `source`) is a separate `Record`, and the `font-semibold` override is applied in RetentionChip's own `cn()` (UI-SPEC Typography).

### `retention/RetentionSection.tsx` / `RetentionFolderLine.tsx` (S7, S8)

**Analog:** `frontend/src/components/metadata/DocumentFileFacts.tsx:1-50`: a pure function of `doc`, a "not recorded" helper (`NotRecorded`, `:16-18`), a date formatter that never substitutes (`:20-32`), and a "no state, no fetch, no title attribute" header line.

**Mount** (`DocumentDetailPanel.tsx:333-335`):
```tsx
        <PanelSection title="File" defaultOpen>
          <DocumentFileFacts doc={doc} currentUserId={currentUserId} />
        </PanelSection>
```
Insert `<PanelSection title="Retention" defaultOpen><RetentionSection … /></PanelSection>` directly after `:335` (UI-SPEC S8: "directly after File").

**Folder line mount:** `LibraryPage.tsx:995` `<FolderDetail`, inside `documentsLead` (`:940`). One `<RetentionFolderLine … />` directly below.

### `DocumentRow.tsx` (S6 mount)

`DocumentRow.tsx:444-446`:
```tsx
            {/* Phase 118 (CLASS-03): one-glance suggestion chip — only when a
                "suggested" _classification is present on this doc. */}
            <ClassificationRowChip doc={doc} onRefresh={onRefresh} />
```
Add one `<RetentionRowChips doc={doc} state={…} />` line directly after it. The same JSX serves browse and Find (`isFind` branch at `:448`).

### Find "Include archived" (S9)

**Chip** (`FindQuickAdd.tsx:311-322`, the always-visible Version chip):
```tsx
      {/* D-06: always visible; a ✕ only away from the default. */}
      <SetChip
        summary={versionSummary(find.version)}
        removeLabel="Remove Version condition"
        expanded={isOpen("version")}
        onOpen={(el) => openFrom({ kind: "version" }, el)}
        onRemove={find.version === "latest" ? undefined : () => dispatch({ type: "SET_VERSION", version: "latest" })}
      />
```
Place the Include-archived toggle immediately after `:322`. ⚠ `SetChip` (`:332-358`) is an *editor-opening* chip (`onOpen`). A plain on/off toggle needs a click-to-toggle variant, and `FilterChip` is its underlying primitive.

**Reducer** (`pages/findState.ts`): action union at `:169` (`{ type: "SET_VERSION"; version: FindVersion }`), case at `:207-208` (`return { ...state, version: action.version, offset: 0 }`), initial state at `:152`, request mapping at `:321` (`version: state.version,`). Add `include_archived` in each of the four places. Tests: `pages/__tests__/findState.test.ts` (`:86`, `:232-233`, `:356`) show the action/offset-reset/request assertions to mirror.

### Delete refusals (S10)

- `DocumentList.tsx:120-136` `handleDelete`: the `catch {}` discards the error. It must read the typed refusal's status.
- `FolderNode.tsx:204-229`: the inline confirm block (`isDeleting && …`, the `Delete <strong>{node.name}</strong>?` sentence, destructive + ghost buttons). The refusal replaces the buttons with one `Close`.
- `WatchedFoldersSection.tsx:339-357` `handlePurge`: the `catch (err) { setError(err?.message || "Failed to purge missing files.") }` already renders server text, so a typed refusal from `purgeWatchFiles` flows through without a new branch.

### `retention/retentionCopy.ts` + fence test

**Analog:** `components/attachments/saveToLibraryCopy.ts:1-40` (port header: what is ported, what is not, and why) and `__tests__/saveToLibraryCopy.test.ts:1-50`:
```ts
import sketchSource from "../../../../../.planning/sketches/274-save-to-library/COPY.js?raw"
...
  it("non-vacuity: both ?raw sources are real", () => {
    expect(sketchSource.length).toBeGreaterThan(500)
  })
  ...
        expect(sketchSource).toContain(`${key}: "${value}"`)
  ...
    expect(checked).toBe(23)
```
⚠ Shape difference: sketch 275 has **no `const COPY = {…}` object**. Its strings live inline in template literals inside `index.html` (e.g. `policyRow` at `:294`). The fence therefore asserts `sketchSource.toContain(value)` for each literal (no `key:` prefix), plus an exact `checked` count for non-vacuity. The strings UI-SPEC changes on purpose (§Sketch deviations: D-11, D-17, D-22, D-26) are **excluded** from the port fence and asserted separately as the contract's text.

### Vitest gate (`scripts/vitest-count-gate.cjs`)

**TARGETS directory entry** (`:6120-6122`):
```js
  // Phase 274-03 — `src/components/attachments` is new and adopted as a DIRECTORY (its three suites
  // and any later one); the two `src/lib/__tests__` suites go by FILE path (no `src/lib` entry).
  "src/components/attachments",
```
**BASELINE pins** (`:4178-4197`): one comment block per plan naming the decisions, then `"<file>.test.tsx": <measured count>, // 275-04 — <what it proves>`. Pin at the measured passing count after RED → GREEN.

⚠ Measured: `src/components/org`, `src/components/library` and `src/components/metadata` have **no directory entries**. Existing suites there are listed by file path (e.g. `"src/components/metadata/__tests__/DocumentFileFacts.test.tsx"`, `"src/components/library/find/__tests__/FindQuickAdd.test.tsx"`). A new suite in any of those directories is ungated unless its file path is added.

### Frontend test shape

**Analog:** `components/attachments/__tests__/SaveToLibraryDialog.test.tsx:11-38`:
```tsx
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock("@/lib/api/attachments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/attachments")>("@/lib/api/attachments")
  return { ...actual, getPromotePreview: vi.fn(), promoteAttachment: vi.fn() }
})
```
Keep the real error class through `importActual`, so a test can `mockRejectedValue(new RetentionError(409, "…"))`. Assert the **rendered words** from the copy port, not just presence by testid (CLAUDE.md G-8 finding: presence assertions miss content drift).

---

## Shared Patterns

### 1. The PUBLIC EXECUTE / default-privilege trap
**Source:** `202_message_artifacts.sql:147-167`, `200_filtered_retrieval_document_scope.sql:249-258`
**Apply to:** every function and table in 204/205, including the redefined `query_user_documents` (today `012:31` grants `authenticated` with no PUBLIC revoke).
Order: `REVOKE … FROM PUBLIC`, `FROM anon` (and `FROM authenticated`/`service_role` for tables, as 202 does), then `GRANT` back only what is needed. Verify with the 202-style VERIFY block, then `get_advisors(security)`.

### 2. org:manage at two walls
**Source:** API `dependencies.py:1072-1089` (`require_org_manage`); DB `116_connector_connections.sql:118-131`
**Apply to:** every retention write, confirm, un-archive and run-now route, and every new table's write policy. Read gating is per route (`org.py:94-101`), because `document-states` is member-readable.

### 3. Rows before bytes; refusals never swallowed
**Source:** `thread_workspace_cleanup.py` + `threads.py:1444-1452` (274 D-08)
**Apply to:** `documents.py` paths 1-2, `folders.py`, `sources.py` paths 4-5, `disposition.py`. Bytes are removed only after the row delete returns; a storage failure is logged, never `pass` (the 274 rule). PT409 is never caught by a broad `except` (Pitfall 4).

### 4. Audit row with explicit org
**Source:** `audit_service.py:59-89` (`write_audit_entry`, swallows and logs), `org.py:585-595` (explicit `org_id`)
**Apply to:** retention admin commands and `folder.delete`. `VALID_ACTION_TYPES` (`audit_service.py:13-28`) must stay a subset of the CHECK, and `assert_action_types_synced` (`:31-56`) hard-fails boot otherwise. Add the 275 types **and** the three missing `connector.watch.*` types in the same change. Ledger row owed for `audit_service.py` (7/7/89, FIRES).

### 5. Fail-closed reads
**Source:** `document_search_service._fetch_all` (`:229-251`); `health_verdict.py:55-59` (unknown counts as unsafe)
**Apply to:** `retention/load.py`, the sweep, Preview and confirm. A truncated, uncounted or cyclic read disposes nothing.

### 6. Async boundaries
**Source:** `app.utils.db.aexec` (used in `audit_service.py:87`, `expert_scope.py:185`, `kb.py:66`); `run_in_threadpool(lambda: …)` (`sources.py:329`, `:468`)
**Apply to:** every supabase-py call in new async code (CLAUDE.md D-v2.5-01). asyncpg is awaited directly.

### 7. Same-commit sync rules
- Deploy parity: 4 artifacts + `config.py` (watch stanzas listed above).
- Hot-file ledger rows + `docs/HOT-FILE-LEDGER.md` sections, same commit (CLAUDE.md). Owed per RESEARCH Q8: `folders.py`, `kb.py`, `audit_service.py`, `sql_service.py` (if touched), and every new module. `sources.py` and `OrgAdminShell.tsx` already have rows; update them.
- Count gate: TARGETS + BASELINE in the commit that adds a suite.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Restrictive GUC-keyed RLS policies (inside `205_retrievable_predicate.sql`) | migration (policy) | read filter | No `AS RESTRICTIVE` policy or `set_config('app.…')` GUC exists in the repo's migrations. Use RESEARCH Pattern 2 + Code Examples (`IS DISTINCT FROM 'on'`, `is_local=true`). |
| Hold triggers on `BEFORE DELETE` / `BEFORE TRUNCATE` / sticky-coverage `BEFORE UPDATE OF folder_id` (inside 204) | migration (trigger) | event-driven | The trigger *skeleton* matches 202, but no existing trigger refuses a delete through FK cascades or guards TRUNCATE. Semantics come from RESEARCH M-3 (measured) and Pattern 3. |
| `retention/DeleteBatchCard.tsx` type-the-count confirm | component | CRUD | No type-the-count input exists in the frontend (grep found no prior instance). Build from UI-SPEC S4 (`inputmode="numeric"`, `aria-describedby`, re-type after untick); the 066 graded-guard rule is in `Skill("sketch-findings-agentic-rag")`. |

---

## Flags for Planning (conflicts found while mapping)

1. **Directory placement disagrees between RESEARCH and UI-SPEC.** RESEARCH puts every leaf under `src/components/retention/` with one TARGETS directory entry (Pitfall 12). UI-SPEC names `components/org/retention/`, `components/library/retention/` and `components/metadata/RetentionSection.tsx`. None of `org`, `library` or `metadata` has a TARGETS directory entry, so the UI-SPEC paths need every suite pinned by file path. Recommendation: keep the components in `src/components/retention/` (one TARGETS entry) and mount them from the UI-SPEC host files. That changes paths only, not design.
2. **S8 says "no fetch", but hold state is not on the document row.** D-17 and RESEARCH Q9 put hold state only in `/retention/document-states`, because `list_documents` returns `select("*")` from `documents` and holds live in other tables. The Retention section, the row chips (S6) and the folder line (S7) therefore need one batched `document-states` read, best owned by `LibraryPage` and passed down so the panel itself stays fetch-free. The planner should name that owner explicitly.
3. **`OrgAdminShell.test.tsx` pins Retention as locked** (`:86-91`, `:193`). Retire it on purpose in plan 04.
4. **`deleteDocument` / `deleteFolder` / `purgeWatchFiles` discard the server's status and detail** (`lib/api/documents.ts:331`). S10 cannot work without a typed refusal (`attachments.ts:64-86` shape).
5. **Preview-token secret (A4).** `oauth_service._get_signing_key` (`:134-148`) documents that `secrets_encryption_key` defaults to `""` and a key-less install is supported (D-150-01). Reusing it would leave Save working on a published or empty key, or failing on key-less installs. Decide at planning: fail closed when the key is empty (Save refused with a reason), or record the preview server-side (a draft hash plus `previewed_revision` row) with no HMAC at all. The second option needs no secret and no deploy-parity item.
6. **`StatusChip` `BASE_CLASSES` is module-private** (`StatusChip.tsx:42`). Export it (additive) or duplicate it with a source comment. See the RetentionChip section.
7. **The `folder_is_org_shared` walk has no cycle bound** (`full-schema.sql:277-288`). Do not copy it bare into `retention_held_documents`.
8. **`_fetch_all`'s non-int-count early return** (`document_search_service.py:240-241`) must not be copied into `retention/load.py`; there it must raise.

---

## Metadata

**Analog search scope:** `supabase/migrations/` (170, 200, 202, 203, 116, 012), `supabase/full-schema.sql`, `backend/app/{api,db,services,models}`, `backend/tests/{unit,integration}`, `frontend/src/{components,lib/api,pages,types}`, `scripts/vitest-count-gate.cjs`, deploy artifacts, `.planning/sketches/275-retention-legal-hold/`
**Files scanned:** ~45 read or grepped
**Pattern extraction date:** 2026-10-12
