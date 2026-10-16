# Phase 280: In Once, Out Clean - Pattern Map

**Mapped:** 2026-10-14 (develop after `866077423`)
**Files analyzed:** 27 new or modified (code, tests, docs)
**Analogs found:** 25 / 27 (2 docs-only files have no code analog; they follow existing doc shapes)

Line numbers were read at HEAD on 2026-10-14. Re-measure them at plan time, because `documents.py`
and `ingest_splice.py` are touched by Plan A before Plan C.

## File Classification

| New/Modified File | Plan | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|---|
| `backend/app/utils/db.py` (+`maybe_row`) | A | utility | transform | `app/utils/db.py::coerce_uid` (same module) + `hold_guard._rows` (`hold_guard.py:294`) | exact |
| `backend/app/services/document_purge.py` (NEW) | A | service | CRUD (delete) + file-I/O | `api/sources.py:328-343` / `:475-489` (bodies to lift) + `retention/disposition.py:507-515` (`_remove_bytes`) | exact |
| `backend/app/api/sources.py` (both doors → helper) | A | controller | request-response | itself (extraction) | exact |
| `backend/app/services/retention/disposition.py` (`_remove_bytes` → import) | A | service | file-I/O | itself `:480`, `:507` | exact |
| `backend/app/api/documents.py` (7 `maybe_row` sites) | A | controller | request-response | `documents.py:1824-1833` (the site itself) | exact |
| `backend/app/api/folders.py`, `skills.py`, `takeoff.py` (sites) | A | controller | request-response | same-shape sites (`takeoff.py:39-49`, `folders.py:98-107`, `skills.py:512-521`) | exact |
| `backend/app/services/ingest_splice.py` `:162`, `:422` (sites) | A | service | CRUD | `ingest_splice.py:160-174`, `:421-425` | exact |
| `backend/app/main.py` (delete `:66-89`) | A | config | n/a | n/a (pure deletion) | n/a |
| `backend/tests/unit/test_275_delete_paths.py` (amend 2 pins) | A | test | n/a | itself `:547-554`, `:598-606` | exact |
| `backend/tests/unit/test_280_purge_bytes.py` (NEW) | A | test (stub + source fence) | CRUD | `test_275_delete_paths.py` fakes `:56-196`, `_Pool` `:434-463`, fence `:637-650` | exact |
| `backend/tests/unit/test_280_delete_404.py` (NEW) | A | test (TestClient) | request-response | `test_270_download_url.py:30-118` | role-match (fake must return `None`) |
| `backend/tests/unit/test_280_maybe_row_fence.py` (NEW) | A | test (AST fence) | batch scan | `test_269_no_expert_specific_code.py:317-394` + `services/sources/test_boundary_fence.py:268-278` | role-match |
| `backend/app/services/sources/adapters/microsoft_graph.py` | B | service (adapter) | request-response | itself, search fix `:320-321` | exact |
| `backend/tests/unit/services/sources/test_280_graph_ids_cannot_shape_the_path.py` (NEW) | B | test | request-response | `test_238_06_search_url_and_folder_path.py:90-153` | exact |
| `backend/app/services/ingest_splice.py` (`mint_document_row`) | C | service | CRUD | itself `:126-350` + `api/workspace_promote.py:150-187` (`find_existing_copy` live leg) | exact |
| `backend/app/api/documents.py` (`/upload` dup branch) | C | controller | request-response | `documents.py:622-626` | exact |
| `backend/app/models/document.py` (+`already_in_library`) | C | model | n/a | `DocumentResponse` defaulted fields `:53`, `:63`, `:81-94` | exact |
| `backend/tests/unit/test_266_mint_org_scope.py` (re-pin) | C | test | CRUD | itself `:43-152`, `:215-252` | exact |
| `backend/tests/unit/test_ingest_splice.py` (relabel 409) | C | test | CRUD | itself `:228-244` | exact |
| `backend/tests/unit/test_280_minter_sequence.py` (NEW) | C | test (stub) | CRUD | `test_266_mint_org_scope.py` `_FakeDB` | exact |
| `backend/tests/integration/test_280_same_bytes_live.py` (NEW) | C | test (live) | CRUD, concurrent | `test_167_jit_race.py:36-110` + `_271_gotrue_users.py` | role-match |
| `backend/tests/integration/test_280_cr01_two_org_live.py` (NEW) | C | test (live) | CRUD | `test_271_two_org_fence.py:46-126` | exact |
| `.planning/reported-bugs/BUG-2610xx-*.md` (NEW, if CR-01 reproduces) | C | record | n/a | `BUG-261012-02-…md` frontmatter | exact |
| `frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx` (extend) | D | test (component) | render | itself `:68-100` + `fixtures.ts:20-45`, `:189-207` | exact |
| `docs/public/administer/org/retention.md` (paragraph) | D | docs | n/a | itself `## Known limits` `:97-102` | exact |
| internal DEBT-08 record (`docs/history/v4.5-find-it-show-it.md` or NEW `docs/RETENTION-AND-ARTIFACTS.md`) | D | docs | n/a | `docs/history/v4.5-find-it-show-it.md` `## Key decisions` `:52` | no code analog |
| `docs/HOT-FILE-LEDGER.md` + `CLAUDE.md` FIRING table | D (rows for new files: planning commit) | docs | n/a | existing ledger rows | no code analog |

---

## Pattern Assignments

### `backend/app/utils/db.py`: add `maybe_row` (utility, transform)

**Analog:** the same module. `coerce_uid` (`:33-44`) is the precedent for a tiny pure helper beside
`aexec`, with a docstring that states the measured reason.

**Import site convention** (`api/documents.py:39`, `api/folders.py:11`):
```python
from app.utils.db import aexec
```
`skills.py` and `takeoff.py` do not import from `app.utils.db` today; each gains one import line.

**Existing None-tolerant reader to mirror** (`services/retention/hold_guard.py:294-298`):
```python
def _rows(resp) -> list[dict]:
    data = getattr(resp, "data", None) if resp is not None else None
```

**Shape** (RESEARCH Code Examples):
```python
def maybe_row(resp):
    """The row a `.maybe_single()` query found, or None. postgrest 2.29 returns None on 0 rows."""
    return resp.data if resp is not None else None
```

**Docstring to update in the same commit as the `main.py` deletion (D-30)** (`db.py:5-9`):
```
SSE-path threadpool wrap referenced in research §A1–A2 — it coexists with
the existing `_patch_postgrest_maybe_single` patch in `main.py:17–40` (both
wrap `execute`; the postgrest patch handles a 204-error edge case at
import time, ...
```

**Site rewrite: two shapes, pick per site.**
- `aexec` sites (`documents.py`), current form at `:1824-1833`:
  ```python
  doc_resp = await aexec(
      supabase.table("documents").select("*").eq("id", document_id)
      .eq("user_id", current_user["id"]).maybe_single()
  )
  if not doc_resp.data:
      raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
  target = doc_resp.data
  ```
  Becomes `target = maybe_row(await aexec(...))` followed by the existing `if not target: raise 404`.
  ⛔ This adds **no `ast.If`**: the `if not …` already exists. The D-32 fence
  (`test_275_delete_paths.py:623-634`) counts `ast.If` in `delete_document` against `PHASE_BASE`.
- `run_in_threadpool(lambda: ….maybe_single().execute())` and sync `.execute()` sites (`takeoff.py:39-49`,
  `folders.py:98-107`, `skills.py:512-521`):
  ```python
  current = (supabase.table("folders").select("id, parent_id").eq("id", folder_id)
             .eq("user_id", current_user["id"]).maybe_single().execute())
  if not current.data:
      raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
  ```
  These read `X.data[...]` again further down, so either bind `row = maybe_row(current)` and replace the
  later reads, or keep `current` and change only the guard to `if not maybe_row(current):`. The fence
  must count `maybe_row(X)` as a guard on `X`. Note: `skills.py:520` answers **403**, not 404. Keep each
  site's existing status code, because only the 500 → existing-branch change is in scope.
- `ingest_splice.py:422-423` (inside `try/except Exception`): `doc = maybe_row(res) or {}`.

---

### `backend/app/services/document_purge.py` (NEW; service, CRUD delete + file-I/O)

**Analog A: the two door bodies being lifted** (`api/sources.py:328-343`, the DELETE door):
```python
if purge_documents:
    items = await get_watch_items(pool, watch_id)
    doc_ids = [str(it["document_id"]) for it in items if it.get("document_id")]
    if doc_ids:
        # Phase 275 (D-14 / D-38): check the hold first; a database refusal is the same 409 and
        # any other error PROPAGATES — the watch is deleted only after its documents were.
        await hold_guard.assert_none_held(
            request, current_user, doc_ids, kind="watch_delete", service_supabase=service_supabase,
        )
        with hold_guard.map_hold_refusal(kind="watch_delete"):
            await run_in_threadpool(
                lambda: supabase.table("documents")
                .delete()
                .in_("id", doc_ids)
                .execute()
            )
```
The purge door at `sources.py:475-489` is identical except that `kind="watch_purge"` and it sets
`purged_count = len(doc_ids)` (RESEARCH recommends `len(deleted)`; record the change).

**Imports to copy** (`sources.py:31`, `:65`):
```python
from starlette.concurrency import run_in_threadpool
from app.services.retention import hold_guard  # Phase 275 (D-38): the one hold check
```
⛔ D-31: call `hold_guard.assert_none_held` and `hold_guard.map_hold_refusal` **through the module
attribute**. `test_275_delete_paths.py` patches `monkeypatch.setattr(hold_guard, "assert_none_held", …)`
(`:231`, `:550`, `:601`, …), so `from …hold_guard import assert_none_held` makes every guard test vacuous.

**Signatures to match** (`hold_guard.py:175-212`):
```python
async def assert_none_held(request, current_user: dict, document_ids: Sequence[str], *, kind, folder_ids=None, service_supabase=None)
@contextmanager
def map_hold_refusal(*, kind: HoldKind, can_manage: bool = False, held_count: int | None = None)
```

**Analog B: the bytes step being lifted byte-identical** (`retention/disposition.py:507-515`):
```python
async def _remove_bytes(storage, paths: list[str], removed: list[str], not_removed: list[str]) -> None:
    if not paths or storage is None:
        return
    try:
        await run_in_threadpool(lambda: storage.storage.from_(STORAGE_BUCKET).remove(paths))
        removed.extend(paths)
    except Exception:
        logger.exception("retention: removing %d file(s) after a confirmed delete failed", len(paths))
        not_removed.extend(paths)
```
`STORAGE_BUCKET = "documents"` (`disposition.py:65`); `logger = logging.getLogger(__name__)` (`:62`).
Its only caller is `disposition.py:480`, `await _remove_bytes(storage, paths, removed, not_removed)`.
Keep the `storage.storage.from_(b).remove(paths)` call shape, because the integration fakes in
`test_275_disposition.py:286-306` and `test_275_review_confirm.py:89-100` depend on it. In `disposition.py`,
alias the import (`from app.services.document_purge import remove_document_bytes as _remove_bytes`), or
update the one call.

**Analog C: the ordering reference that stays inline (D-12, D-32)** (`documents.py:1873-1884`):
```python
await hold_guard.assert_none_held(request, current_user, [document_id], kind="document", service_supabase=service_supabase)
with hold_guard.map_hold_refusal(kind="document"):
    await aexec(supabase.table("documents").delete().eq("id", document_id).eq("user_id", current_user["id"]))
# D-10 / D-38: storage file AFTER the row; a failure is logged, never blocks the delete
try:
    await run_in_threadpool(lambda: supabase.storage.from_("documents").remove([target["file_path"]]))
except Exception as exc:
    log.warning("delete_document: storage remove failed for %s: %s", target.get("file_path"), exc)
```

**Helper body (composed from A + B, per D-31):** guard → `with map_hold_refusal:` DELETE (keep the
`.execute()` result, since PostgREST returns the deleted rows by default) → `remove_document_bytes(supabase,
[r["file_path"] for r in deleted if r.get("file_path")], removed, not_removed)` using the **user-JWT**
client (mig 206's storage DELETE policy is defence-in-depth). Only the storage remove may sit inside a
`try`. The doors keep no `except` (pinned by `test_275_delete_paths.py:667-672`).

---

### `backend/app/api/sources.py`: extraction FIRST (controller, request-response)

**Analog:** itself. Keep the route signatures exactly (`:306-318`, `:438-449`), including
`service_supabase: Client = Depends(get_supabase)` and `pool=Depends(get_pg_pool)`. The tests call the
coroutines directly with those keyword names (`test_275_delete_paths.py:484-508`). The 404 preamble
(`existing = await get_watch(...)`; `if not existing: raise HTTPException(404, "Watch not found or
unauthorized.")`) and the post-purge steps (`delete_watch` at `:345`; the `connector_watch_items` DELETE at
`:491-496`) stay in the route. Only the guard + delete block moves into the helper.

---

### `backend/tests/unit/test_280_purge_bytes.py` (NEW; test, stub + source fence)

**Analog:** `backend/tests/unit/test_275_delete_paths.py`. Import or copy its fakes; do not write new ones.
- Recording fakes `_Resp`, `_Query`, `_FakeSupabase` (`:56-137`). `_FakeSupabase.storage.from_().remove`
  logs `("storage","remove",paths)` and honours `remove_raises` (`:99-110`).
- `_guard(log, refuse=…)` (`:148-158`), `_refusal(kind, n)` (`:161-162`), `_pt409()` (`:165-167`),
  `_kinds/_deletes/_removes` (`:170-192`), `_run = asyncio.run` (`:195`).
- `_Con/_Acquire/_Pool` (`:434-463`) and `_patch_watch` (`:466-481`) for the two doors.
- ⚠ `answer()` returns `[]` for a non-single `("documents","delete")` (`:129-137`). Give the purge tests
  `answers={("documents","delete"): [{"id": DOC, "file_path": f"{USER}/doc.pdf"}, …]}` so that bytes exist
  to remove.

**Order assertion style** (`:547-554`):
```python
order = [e[0] if e[0] in ("guard", "watch") else f"{e[0]}.{e[1]}" for e in log]
assert order == ["guard", "documents.delete", "watch"]
```
New: `["guard", "documents.delete", "storage.remove", "watch"]`, and for the purge door
`[…, "storage.remove", "pool"]`.

**Helper source fence**: copy `_function_node` (`:611-616`) and the call-line scan of
`test_every_storage_remove_in_delete_document_follows_its_row_delete` (`:637-650`):
```python
body_nodes = [n for stmt in node.body for n in ast.walk(stmt)]
for n in body_nodes:
    if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute):
        if n.func.attr == "remove": removes.append(n.lineno)
        elif n.func.attr == "delete": deletes.append(n.lineno)
```
Assert `assert_none_held` line < `.delete(` line < every `.remove(` line (or < the
`remove_document_bytes(` call line) inside `purge_documents`.

**Amend in the same commit, with the reason in the test (D-31):** `test_275_delete_paths.py:554`
and `:606`. Both lists gain `"storage.remove"`, and their fakes need delete rows that carry `file_path`.

---

### `backend/tests/unit/test_280_delete_404.py` (NEW; TestClient, request-response)

**Analog:** `backend/tests/unit/test_270_download_url.py:9-118`.

**Imports + override pattern** (`:15-20`, `:116-118`):
```python
from fastapi.testclient import TestClient
from app.dependencies import get_supabase, get_user_supabase_client
from app.main import app
...
app.dependency_overrides[get_user_supabase_client] = lambda: user
app.dependency_overrides[get_supabase] = lambda: service
return TestClient(app), user, service, log
```
`tests/conftest.py:147-173` (autouse) restores the overrides after each test and pre-sets
`get_current_user`, so no teardown is needed.

**Fake query builder** (`:30-52`), with one change: `.execute()` after `.maybe_single()` must return
**`None`**, not `SimpleNamespace(data=None)`, to mirror postgrest 2.29
(`SyncMaybeSingleRequestBuilder.execute`). Both existing fakes (`test_270` `:52` and `test_275` `:136`)
return an object with `data=None`, which is exactly why neither could see BUG-261012-02.

**CORS**: `main.py:868-873` sets `allow_origin_regex=r"http://localhost:\d+"`, so send
`headers={"Origin": "http://localhost:5173"}`. Use `TestClient(app, raise_server_exceptions=False)`
(precedent `test_238_source_families_route.py:123`) so a regression shows as a 500 rather than a raised
exception. Assert status 404, `res.json() == {"detail": "Document not found"}`, and
`res.headers["access-control-allow-origin"]` for the foreign-row and nonexistent-id cases, with
**identical** bodies (D-09). No test in `backend/tests` asserts that header today, so this is new ground
and needs a positive control.

---

### `backend/tests/unit/test_280_maybe_row_fence.py` (NEW; AST fence over `backend/app`)

**Analog 1, the file walk plus non-vacuity floor** (`test_269_no_expert_specific_code.py:317-330`, `:377-381`):
```python
def scan_backend(needles, *, exclude_docstrings=True):
    files = sorted(BACKEND_APP.rglob("*.py"))
    for f in files:
        tree = ast.parse(f.read_text(encoding="utf-8-sig"), filename=str(f))
        ...
    return len(files), hits
...
assert count > 100, f"scanned only {count} backend files — the scan root moved"
```
Parameterise the root: `def scan(root: Path) -> tuple[int, list[str]]`, the Python equivalent of the
`scripts/check-docs-coverage.cjs:27,69-71` `--root` precedent. The RED drive then plants into a
`tmp_path` copy and never edits `backend/app`.

**Analog 2, the positive control** (`services/sources/test_boundary_fence.py:268-278`):
```python
def test_the_fence_can_actually_fire():
    planted = 'def f(service_id):\n    if "google" in service_id:\n        return 1\n'
    findings = _scan(planted)
    assert findings, "the fence cannot detect the leak it exists to detect"
```
Plant the BUG-261012-02 shape (`r = q.maybe_single().execute()` followed by `if not r.data:`). Also plant
each recognised guard shape as a negative control (`maybe_row(r)`, `r.data if r`, `r and r.data`,
`r is None`, `getattr(r, "data"`), so that "found nothing" cannot mean "looked for nothing".

Required elements (RESEARCH Pattern 3): a floor of ≥ 100 `maybe_single()` sites (117 measured); a named
allowlist with reasons (`services/harness/skill_snapshot.py:70`, the factory that returns the builder);
an empty unguarded set. Reuse `_function_node` from `test_275_delete_paths.py:611-616` if per-function
reporting is wanted.

---

### `backend/app/services/sources/adapters/microsoft_graph.py` (adapter, request-response)

**Analog:** the shipped WR-01 fix in the same file (`:320-321`):
```python
safe = quote(query.replace("'", "''"), safe="")
url = f"{GRAPH_API_BASE}/me/drive/root/search(q='{safe}')"
```
`quote` is already imported (`:41`, `from urllib.parse import quote, unquote`).

**Sites to route through `_item_segment(id)`** (D-28):
- `_children_url` (`:164-168`):
  ```python
  @staticmethod
  def _children_url(folder_id: str | None) -> str:
      if folder_id in VIRTUAL_ROOT_IDS:
          return f"{GRAPH_API_BASE}/me/drive/root/children"
      return f"{GRAPH_API_BASE}/me/drive/items/{folder_id}/children"
  ```
- `read_file` (`:388-395`): `f"{GRAPH_API_BASE}/me/drive/items/{file_id}"`
- `filename = meta.get("name") or f"file_{file_id}"` (`:401`) is a display fallback, not a URL; leave it.

**Refusal style to copy** (`_get_page` `:214-221`): raise `ValueError` with a sentence that names what
was refused and why, and truncate long input (`{page_token[:60]!r}`).

**Stale comment to fix (D-17)** (`:225-229`): it claims "the search term rides HERE, in a params
VALUE". The `:305-319` block already states the truth (percent-encoded into the OData function). Make
`:225-229` agree with it and do not touch the cursor check (A3).

---

### `backend/tests/unit/services/sources/test_280_graph_ids_cannot_shape_the_path.py` (NEW)

**Analog:** `test_238_06_search_url_and_folder_path.py`. Copy, in order:
- imports (`:48-59`), `CONN` (`:61`), `_json` (`:64-69`), `_Recorder` (`:72-87`), the `adapter` fixture
  that monkeypatches `get_fresh_access_token` (`:90-96`), and `_install` that monkeypatches
  `send_pinned_http` (`:99-104`);
- the hostile parametrize table (`:110-119`):
  ```python
  @pytest.mark.asyncio
  @pytest.mark.parametrize("hostile,what_it_would_do", [
      ("a')?$expand=children&x=('", "terminate the path and add a real OData parameter"),
      ("a')/../../me/drive/root/children?x=('", "choose a different Graph endpoint"),
      ("a#fragment", "truncate the request at a fragment"),
      ("a&$top=999", "override the page size"),
  ])
  ```
  For ids, use RESEARCH Pattern 5's measured rows: `x/../../drives/D1/root`, `x?$expand=children&a=`,
  `a#frag`, plus refusals for `""`, `"."` and `".."`.
- the assertion style (`:127-153`): the URL starts with `GRAPH_API_BASE`, no `?`/`#`/`&` survives, and
  no unencoded `/` appears inside the id segment. ⚠ Heed its `:140-146` lesson and do **not** assert
  `".." not in url`, because `.` is unreserved. Assert after `httpx.URL(issued)` normalisation (the
  measured attack is httpx collapsing dot segments).
- a positive control in the `:188-208` style: a real personal id `ABC123!105` is issued with `!`
  literal, and browsing still returns its items.

Drive `list_files(CONN, folder_id=hostile)` for `_children_url` and `read_file(CONN, hostile)` for
`items/{id}`.

---

### `backend/app/services/ingest_splice.py`: `mint_document_row` (service, CRUD)

**Analog 1: the function itself.** Its current step lines are in RESEARCH Pattern 1. Key excerpts:

Folder check (`:160-174`; the CR-01 + DEBT-11 site):
```python
if folder_id:
    folder_check = (supabase.table("folders").select("id, user_id")
                    .eq("id", folder_id).maybe_single().execute())
    if not folder_check.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder_check.data["user_id"] != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot upload to a folder you do not own")
```
D-26: select `id, user_id, org_id`. An org mismatch, or a non-member when `org_id is None`, raises the
**identical** `HTTPException(status_code=404, detail="Folder not found")`. Otherwise set
`org_id = folder.org_id` when it was None.

Retire-before-insert, which is the defect (`:259-271`):
```python
existing_versions = versions_query.order("version_number", desc=True).limit(1).execute()
if existing_versions.data:
    next_version = existing_versions.data[0]["version_number"] + 1
    retire_query = supabase.table("documents").update({"is_latest": False}).eq("user_id", user_id).eq("filename", filename)
    if org_id: retire_query = retire_query.eq("org_id", org_id)
    if folder_scoped: ...
    retire_query.execute()
```
D-25: keep the read here and move the `retire_query` build and execute to **after**
`result = supabase.table("documents").insert(doc_data).execute()` (`:308`), adding
`.neq("id", doc["id"]).lt("version_number", next_version)` and org from `doc.get("org_id")` when `org_id`
was not passed. Wrap it in its own `try/except` that logs and still returns the minted row.

23505 arm (`:316-350`): keep the `"23505" in str(exc)` detection and the folder-scoped re-query
(`:324-337`), but run it for **both** `raise` and `link`. Keep the 409 (`:346-349`) only as the
"re-query found nothing" fallback.

**Analog 2: the in-flight dedup leg** (`api/workspace_promote.py:176-187`), the shape D-24 adopts:
```python
live = await aexec(
    supabase.table("documents").select("*")
    .eq("user_id", user_id).eq("content_hash", content_hash)
    .neq("status", "failed").eq("is_latest", True)
    .eq("org_id", org_id)
    .order("created_at", desc=True).limit(1)
)
return live.data[0] if live.data else None
```
In the minter it is sync (`.execute()`, since the function already runs in `run_in_threadpool` via
`async_mint_document_row` `:353`), and `.eq("org_id", …)` applies only `if org_id:`. A hit returns:
```python
return MintResult(document=existing_doc, is_duplicate=True,
                  storage_path=existing_doc.get("file_path", ""), version_number=existing_doc.get("version_number", 1))
```
(`:233-239`). Comment convention: the file keeps superseded paragraphs and corrects them in place
(`:197-201`, `:216-220`). Correct the docstring steps 3/4/7 (`:146-157`) the same way.

---

### `backend/app/api/documents.py`: `/upload` dup branch (controller)

**Analog:** itself (`:622-626`):
```python
doc = mint_result.document
if mint_result.is_duplicate:
    response.status_code = status.HTTP_200_OK
    return doc
```
Becomes `return {**doc, "already_in_library": True}`, with no new `if`. The route is
`response_model=DocumentResponse` (`:556`), so the field must exist on the model or FastAPI strips it.

### `backend/app/models/document.py`: `+already_in_library` (model)

**Analog:** the defaulted-field precedent with a dated reason comment (`:50-53`):
```python
# Phase 217 (D-217-08) — ... DEFAULTED because five routes build their response from a narrow select ...
extractor: str | None = None
```
Add `already_in_library: bool | None = None` with a `# Phase 280 (FIX-02 / D-01)` comment. No frontend
change is needed (`frontend/src/lib/api/documents.ts:52` already maps 200 to `isDuplicate`).

---

### `backend/tests/unit/test_280_minter_sequence.py` (NEW) + re-pin of `test_266_mint_org_scope.py`

**Analog:** `test_266_mint_org_scope.py`. Its in-memory fake **applies** filters (`:48-136`), so a
missing predicate returns the wrong row rather than just a missing call:
```python
class _Site:
    eq = _rec("eq"); neq = _rec("neq"); is_ = _rec("is_"); order = _rec("order"); limit = _rec("limit"); maybe_single = _rec("maybe_single")
    def _matches(self, row): ...  # eq / neq / is_ null
    def execute(self):
        if self.kind == "insert":
            if self.db.insert_error is not None: raise self.db.insert_error
            self.db.rows.append(dict(self.arg)); return _Result([dict(self.arg)])
```
⚠ Fake gaps the new minter will hit:
1. There is no `lt`. Add `lt = _rec("lt")`, plus `_matches` support and `"lt"` in `_FILTERS` (`:40`).
2. `_FakeDB.table` asserts `name == "documents"` (`:134-136`). A folder-bearing test needs a `folders` table.
3. Inserted rows carry no trigger-stamped `org_id`, so the minter must read `doc.get("org_id")`.
4. `link_site()` (`:150-152`) finds the first select with `neq status failed`, which the **new in-flight
   leg** will also match. Disambiguate by the `is_latest` filter, or by folder predicate presence.

**Re-pin, same commit, reason written in the test (Pitfall 1):** `_BASE_SEQUENCE` (`:215-241`) and
`test_upload_path_without_org_issues_the_base_queries_exactly` (`:244-254`). The new order is:
completed dedup → in-flight select → version select → insert → (23505) re-query, with the retire
moving after a successful insert. `test_upload_path_insert_payload_carries_no_org_id` (`:257-261`) has no
folder and stays green.

---

### `backend/tests/integration/test_280_cr01_two_org_live.py` (NEW; live)

**Analog:** `backend/tests/integration/test_271_two_org_fence.py`.

Imports + skip guards (`:25-41`):
```python
from tests.integration._271_gotrue_users import GoTrueUsers, memberships, require_gotrue, user_client
from tests.integration._rls_harness import requires_pg
pytestmark = requires_pg
```
Seeding with an explicit `org_id` that is proven to have landed (`:46-70`):
```python
await pool.execute(
    "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) VALUES ($1, $2, $3, $4, true)",
    folder_id, UUID(owner_uid), UUID(org_id), f"271-fence-{marker}",
)
```
Fixture shape: `require_gotrue()`, then `try:` create users and seed, `yield`, then `finally:` cleanup
and `users.drop_all()` (`:103-126`).

⚠ `GoTrueUsers.create_signed_in_user` (`_271_gotrue_users.py:132-165`) leaves **exactly one**
membership by design. CR-01 needs a **two-org** subject, so add the second
`INSERT INTO public.org_members (org_id, user_id, role)` with `pg_pool` **before** sign-in, or accept that
the token predates it (membership is read per request by RLS, so either works). Then read the trigger's
pick (`SELECT org_id FROM org_members WHERE user_id=$1 LIMIT 1`) and seed the folder in the other org.
Call `async_mint_document_row(supabase=user_client(token), folder_id=…, org_id=None)`, the `/upload` shape.
Use `create_org`/`drop_org` (`:107-122`) for the second org. Cleanup must also delete minted
`documents` rows (user delete cascades them through `documents_user_id_fkey`) and any `storage.objects`.
Fixtures `pg_pool` and `two_orgs_two_users` live in `tests/integration/conftest.py:75`, `:98`.

### `backend/tests/integration/test_280_same_bytes_live.py` (NEW; live, concurrent)

**Analog:** `test_167_jit_race.py:36-110` for the race, plus the user and client helpers above.
```python
results = await asyncio.gather(
    inv.accept_invitation(pg_pool, token_hash, str(invitee)),
    inv.accept_invitation(pg_pool, token_hash, str(invitee)),
)
n = await pg_pool.fetchval("SELECT count(*) FROM ... WHERE ...", ...)
assert n == 1, f"expected exactly one ..., got {n}"
```
Apply it as `asyncio.gather(async_mint_document_row(supabase=user_client(tok), …),
async_mint_document_row(supabase=user_client(tok), …))`, using **two separate clients** (Pitfall 4).
Assert by SQL: exactly one non-failed row for (user, hash), `is_latest = true`, and both results have
the same `document["id"]`. The sequential RED case seeds a `pending` row (`status='pending'`), then
mints the same bytes and asserts that the pending row is still `is_latest` and that no 409 is raised.
Parametrize over the 7 caller parameter sets (RESEARCH Pattern 1 caller matrix). Use the service
client (`_271_gotrue_users._admin()`) for the service-role callers. ⚠ `tests/conftest.py:10-11` points
`settings` at a placeholder (Pitfall 6), so build every client from `_local_env()`.

---

### `frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx` (extend; DEBT-08)

**Analog:** the caption assertion in the same file (`:95-100`):
```tsx
expect(within(figures[1]).getByTestId("artifact-caption")).toHaveTextContent(
  "table 1Data: query_tables · Quarterly_Report_FY25.pdf p.4 · 16 rows",
)
```
Build the record from the existing fixture builder (`fixtures.ts:20-45`, the `base(id, label,
component, spec, caption, rowCount)` signature), e.g. a copy of `table16` (`fixtures.ts:189-207`) with
`caption: { row_count: 16, sources: [{ tool: "query_tables", document: "contract.pdf", page: null }],
source_count: 1, lineage: null }`. The caption renders through `captionModel.ts` `captionSegments`
(`sources.map(captionSource)`) into `ArtifactFrame.tsx`'s `<figcaption data-testid="artifact-caption">`
as a `<span>` of text. Assert the caption **text content** includes `contract.pdf` and
`figure.querySelector("a")` is `null` (content, not presence, per the 235 lesson the file header cites
at `:4-5`).

---

### Docs (Plan D)

- **`docs/public/administer/org/retention.md`**: add the D-07 paragraph beside `## Known limits`
  (`:97-102`), in the same bullet voice (`- **Bold lead.** Plain sentence.`). The frontmatter carries
  `updated: v4.5` (`:8`); bump it per that page's convention. Afterwards run
  `node scripts/check-docs-coverage.cjs`.
- **Internal record**: `docs/history/v4.5-find-it-show-it.md` has `## Key decisions` (`:52`) and
  `## Gaps and deferred work` (`:78`). A dated "Decision 280 / DEBT-08" entry fits under Key decisions.
- **Bug report (if CR-01 reproduces)**: copy the frontmatter of
  `.planning/reported-bugs/BUG-261012-02-…md:1-17` (`id`, `title`, `reported`, `surface: Agentic-RAG`,
  `severity`, `status`, `affected_areas`, `folded_into: "280"`, `verified_closed_by: null`,
  `reproduces_on: {branch, commit, date}`).

---

## Shared Patterns

### Hold-guard ordering (T-275-12 / D-38). Applies to `document_purge.py` and both `sources.py` doors
Source: `api/documents.py:1851-1869` and `sources.py:332-343`. The order is
`await hold_guard.assert_none_held(...)` → `with hold_guard.map_hold_refusal(kind=…):` row delete →
bytes in a `try/except Exception: log`. Call the guard through the module attribute, never imported by name.

### Blocking supabase-py off the event loop (D-v2.5-01). Applies to every async helper
Source: `app/utils/db.py:47-59` `aexec(query)`, or `run_in_threadpool(lambda: ….execute())`
(`sources.py:338-343`). The minter is sync and is already wrapped by `async_mint_document_row`
(`ingest_splice.py:353-369`), so do not nest another threadpool inside it.

### Non-oracle 404 (D-05 / D-09). Applies to the minter folder check and `DELETE /documents/{id}`
Each case reuses the **existing** `raise HTTPException(status_code=404, detail="…not found")` branch
with an identical body. No new branch tells "exists but not yours" apart from "does not exist".

### Fences that were driven RED (the positive-control rule)
Sources: `test_boundary_fence.py:268-278`, `test_269_…:387-394`, `test_275_delete_paths.py:616`
(`raise AssertionError(... "the fence would pass vacuously")`). Every new fence carries a non-vacuity
floor and a planted positive control, and plants go into a temp copy or a string, never into app code.

### Deliberate pin amendment
`test_275_delete_paths.py:554`, `:606` and `test_266_mint_org_scope.py:215-252` change **in the same
commit** as the code they pin, with the reason written in the test. Pins are never deleted.

### Dated in-place correction comments
`ingest_splice.py:197-201`, `:216-220` and `microsoft_graph.py:190-221` show the convention: a
superseded comment is kept and corrected beside it (`⚠ CORRECTED (…)`), not overwritten.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| Internal DEBT-08 decision record | docs | No `docs/` file covers retention design; follow `docs/history/v4.5-find-it-show-it.md` section shape |
| `Team Docs` scratchpad generator (not in tree) | script | One-off fixture outside the repo; D-27 layout (95 top-level files + `Q3 Plans/` with 10) |

## Metadata

**Analog search scope:** `backend/app/{api,services,utils,models}`, `backend/tests/{unit,integration}`,
`backend/tests/unit/services/sources`, `frontend/src/components/chat/artifacts`, `docs/public`,
`docs/history`, `.planning/reported-bugs`, `scripts/check-docs-coverage.cjs`
**Files scanned:** ~30 read or grepped
**Pattern extraction date:** 2026-10-14
