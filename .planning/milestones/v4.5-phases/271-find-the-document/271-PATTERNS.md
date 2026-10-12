# Phase 271: Find the Document - Pattern Map

**Mapped:** 2026-10-03 (HEAD `56630a65b`)
**Files analyzed:** 33 new/modified (14 new, 19 modified)
**Analogs found:** 32 / 33. One partial: the `has_earlier` lineage batch read has no exact analog.

All line numbers below were read at HEAD this session. The Library files churn fast, so re-derive them before you quote them in a plan.

---

## File Classification

### Backend

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/document_search_service.py` (NEW) | service (FastAPI-free core) | request-response, read + transform (filter, sort, page) | `backend/app/services/document_view_resolver.py` (`resolve_filter`, `ResolveError`) | exact (role + flow) |
| `backend/app/services/document_view_resolver.py` (MODIFY: extract `_apply` to `apply_fragments`) | service | transform | itself, lines 254-318 | self |
| `backend/app/models/document_search.py` (NEW) | model (Pydantic request) | request-response | `backend/app/models/document_view.py` (`ViewCondition` Literal ops, `AdHocResolve`) | exact |
| `backend/app/api/document_search.py` (NEW, `POST /document-search`) | route/controller | request-response | `backend/app/api/document_views.py` `resolve_adhoc` (lines 263-300) | exact |
| `backend/app/main.py` (MODIFY: +1 `include_router`) | config | — | `main.py:879` / `:896` (one-route-module precedent comments) | exact |
| `backend/tests/unit/test_271_search_core.py` (NEW) | test (unit, fake builder) | — | `backend/tests/unit/test_116_handler.py` `_FakeQuery` (lines 51-118) | role-match |
| `backend/tests/unit/test_271_no_embedding.py` (NEW) | test (static fence + patched falsification) | — | `backend/tests/unit/test_189_no_egress.py` + `test_115_resolver_extraction.py` | role-match |
| `backend/tests/integration/test_271_search_live.py` (NEW) | test (live DB, content) | — | `backend/tests/integration/test_114_resolve_adhoc.py` | exact |
| `backend/tests/integration/test_271_two_org_fence.py` (NEW) | test (real RLS fence) | — | `backend/tests/integration/test_266_two_org_fence.py` | exact |

### Frontend

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/pages/findState.ts` (NEW) | store (pure reducer leaf) | event-driven (actions) | `frontend/src/pages/librarySelection.ts` | exact |
| `frontend/src/pages/__tests__/findState.test.ts` (NEW) | test | — | `frontend/src/pages/__tests__/librarySelection.test.ts` (strict-leaf fence, lines 550-573) | exact |
| `frontend/src/hooks/useDocumentFind.ts` (NEW) | hook (request sequencing) | request-response, debounced | `FilterBar.tsx:94-131` (debounce + `reqIdRef`) + `LibraryPage.tsx:438-460` (`resolveFilterIntoList`, **minus its catch**) | role-match |
| `frontend/src/lib/api/documents.ts` (MODIFY: + `searchDocuments`) | api client | request-response | `frontend/src/lib/api/knowledge.ts:293-305` (`resolveAdHoc`) | exact |
| `frontend/src/types/index.ts` (MODIFY: Find wire types) | model (types) | — | 270's additive `Document` fact fields + `DocumentDownloadUrl` | exact |
| `frontend/src/components/library/find/FindModeSwitch.tsx` (NEW) | component | event-driven | `LibraryHeaderBar.tsx:119-169` (segmented control) | role-match (roles change: radiogroup) |
| `frontend/src/components/library/find/FindMetaLine.tsx` (NEW) | component | display | `FilterBar.tsx:240-256` (match count) + `DocumentsPager.tsx` (`Select`) | role-match |
| `frontend/src/components/library/find/AskHandoffCard.tsx` (NEW) | component | event-driven (handoff) | `ClassificationRulesPage.tsx` card/state idiom + `startScopedChat.ts` (ordered handoff) | role-match |
| `frontend/src/components/library/find/*Popover.tsx` (NEW: Folder / Relationship / Version / AddedBy / Date) | component | event-driven | `ConditionPopover.tsx:199-238` (popover shell) | exact |
| `frontend/src/components/relationships/LinkTargetCombobox.tsx` (NEW, EXTRACTED) | component | event-driven | `CreateLinkDialog.tsx:206-275` | exact (a move) |
| `frontend/src/components/relationships/CreateLinkDialog.tsx` (MODIFY: mount the extracted combobox) | component | — | itself | self |
| `frontend/src/components/relationships/relationshipLabels.ts` (MODIFY: + derived 8-verb table) | utility | transform | itself (`OUTGOING_LABEL` / `INCOMING_LABEL` / `REL_TYPES`) | self |
| `frontend/src/components/ingestion/FilterBar.tsx` (MODIFY) | component | event-driven | itself | self |
| `frontend/src/components/ingestion/ConditionPopover.tsx` (MODIFY) | component | event-driven | itself (`fields` memo, lines 118-134) | self |
| `frontend/src/components/ingestion/DocumentList.tsx` / `DocumentRow.tsx` (MODIFY: Find column set) | component | display | themselves + `DocumentFileFacts.tsx:32-43` (`addedBy`) | self |
| `frontend/src/components/library/DocumentsPager.tsx` (REUSE, possibly +1 prop) | component | display | itself | self |
| `frontend/src/pages/LibraryPage.tsx` (MODIFY) | page | event-driven | itself (`pageReducer` boundary, `documentSurface(lead)`) | self |
| `frontend/src/components/library/LibraryHeaderBar.tsx` (MODIFY: + `onOpenFilingRules`) | component | event-driven | itself (`library-queue-pill`, lines 173-201) | self |
| `frontend/src/components/classification/ClassificationRulesPage.tsx` (MODIFY: `embedded`, rename) | page/component | CRUD (unchanged) | itself | self |
| `frontend/src/components/classification/RuleBuilderPanel.tsx` (MODIFY: line 287 label) | component | — | itself | self |
| `frontend/src/lib/nav-items.ts` + `nav-items.test.ts` (MODIFY) | config + test | — | themselves | self |
| `frontend/src/App.tsx` (MODIFY: union line 127) | config (type) | — | itself | self |
| `frontend/src/components/layout/ChatLayout.tsx` (MODIFY: retire branch, add `onAskInChat`) | layout | event-driven | itself (`handleTryInChat` 279-282, `startScopedChat` mount 1072-1090) | self |
| `frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx` (MODIFY: line 396) | test | — | itself | self |

---

## Pattern Assignments

### `backend/app/services/document_search_service.py` (service, read + transform)

**Analog:** `backend/app/services/document_view_resolver.py` (379 lines, read whole).

**Module contract to copy** (docstring lines 1-35). The new core must be FastAPI-free, raise a plain error, scope every leg from the CALLER, and run every `.execute()` through `aexec`. Copy the shape of the docstring's "Safety invariants" list. Add the new ones: no embedding call (D-03), unreachable folder returns zero rows (the opposite of D-113-5), and exact total.

**Imports pattern** (lines 37-46):
```python
from datetime import date, timedelta

from supabase import Client

from app.models.document import DocumentMetadata
from app.models.document_view import ViewFilter
from app.services import metadata_field_service, view_filter_compiler
from app.services.harness.scope import resolve_project_subtree
from app.utils.db import aexec
from app.utils.folder_utils import fetch_visible_folders, get_globally_visible_folder_ids
```
The new module adds: `from app.services.document_view_resolver import ResolveError, _build_field_meta, _relative_window, apply_fragments` and `from app.services.document_relationship_service import _INVERSE_LABEL, _resolve_readable_latest, _subject_version_ids`. ⛔ Do not import `openai_service`, `embedding_service`, `retrieval_service`, or anything that calls `.rpc(`. `test_271_no_embedding.py` fences this.

**Error type to reuse, not redefine** (lines 49-62):
```python
class ResolveError(Exception):
    def __init__(self, detail: str, status: int = 422):
        super().__init__(detail)
        self.detail = detail
        self.status = status
```
Either reuse `ResolveError` or add a subclass, such as `SearchTruncatedError(ResolveError)` with `status=503`. Never raise `HTTPException` from the core.

**Metadata validation, copy verbatim** (lines 198-228). This includes the defense-in-depth re-check of `frag.leg` and `frag.field` against `PROMOTED_TYPED_COLUMNS` and the whitelist:
```python
whitelist, number_fields = await _build_field_meta(caller, supabase)
try:
    view_filter_compiler.validate_fields(flt, whitelist)
    view_filter_compiler.validate_operands(flt, number_fields)
except ValueError as e:
    raise ResolveError(detail=str(e))
fragments = view_filter_compiler.compile_filter(flt)
promoted_cols = set(view_filter_compiler.PROMOTED_TYPED_COLUMNS.values())
for frag in fragments:
    if frag.leg == "typed":
        if frag.field not in promoted_cols:
            raise ResolveError(detail=f"filter field {frag.field!r} is no longer available")
    ...
```
⚠ This block is the second copy of the validation. Prefer extracting it to a module-level `validate_and_compile(caller, flt, supabase) -> list[Fragment]` in the resolver, alongside `apply_fragments`, so both callers share it. That follows the same D-115-6 "one core, no fork" rule.

**Folder subtree, a DIFFERENT rule from the analog** (lines 242-252). Copy the mechanics (`resolve_project_subtree` intersected with `fetch_visible_folders`). Invert the empty case:
```python
# analog (D-113-5): empty → subtree = None (NO narrowing)  ⛔ do NOT copy this line
subtree = reachable or None
# Find: empty → return the zero-result shape immediately (never "no narrowing")
```
`folder_id=None` ("Not in a folder") maps to `q.is_("folder_id", "null")`. `include_subfolders=False` maps to `[folder_id] ∩ visible`.

**Two-leg visibility, copy the leg shape** (lines 320 and 349-375). Find changes the `select` columns, removes the hard `is_latest=True` (version state decides it), adds `count="exact"` and `.range()`, and replaces the `created_at` sort:
```python
global_folder_ids = await get_globally_visible_folder_ids(supabase, caller)
own = _apply(supabase.table("documents").select("*").eq("user_id", caller).eq("is_latest", True))
...
if global_folder_ids:
    glob = _apply(supabase.table("documents").select("*").in_("folder_id", global_folder_ids).eq("is_latest", True))
seen: set[str] = set(); merged: list[dict] = []
for d in own_docs + global_docs:
    if d["id"] not in seen:
        seen.add(d["id"]); merged.append(d)
```
Keep the two legs as two separate queries (RESEARCH A6). Never collapse visibility into one `or_`.

**Truncation-aware paging, copy the loop** from `backend/app/utils/folder_utils.py:74-127` (`fetch_all_folders(strict=True)`):
```python
resp = await aexec(supabase.table("folders").select(fields, count="exact"))
rows = resp.data or []
total = getattr(resp, "count", None)
if not isinstance(total, int) or total <= len(rows):
    return rows
page_size = len(rows)
if page_size > 0:
    while len(rows) < total:
        page = await aexec(supabase.table("folders").select(fields).range(len(rows), len(rows) + page_size - 1))
        batch = page.data or []
        if not batch:
            break
        rows.extend(batch)
    if len(rows) >= total:
        return rows
raise FolderReadTruncatedError(...)
```
The `isinstance(total, int)` guard is required: a test-double `MagicMock` count must not be read as truncation. Apply the leg filters to a FRESH builder on every page (RESEARCH §Code Examples `fetch_all(apply)`).

**Relationship allow-list, reuse the shipped readers** (`backend/app/services/document_relationship_service.py`):
- `_INVERSE_LABEL` (lines 56-61) is the single vocabulary source for the 8 verb keys. Derive the server's closed `Literal` from it, never retype.
- `_resolve_readable_latest(doc_id, caller, supabase=...)` (lines 162-266). It returns `None` for an unreadable id. Map `None` to the same zero-result shape (no existence oracle).
- `_subject_version_ids(row, supabase=...)` (lines 130-159) gives the lineage ids, keyed on `(user_id, filename)`.
- Edges are read with the user-JWT client, so RLS (`auth.uid() = user_id`) already owner-scopes them. Apply the resulting id set with `.in_("id", ids)` **inside** both visibility legs, so it can only narrow.

**Relative dates:** call `_relative_window(builder, n, unit)` (resolver lines 78-118). ⛔ Do not re-derive window math (D-114-16).

**`has_earlier` lineage step.** No exact analog. The nearest shape is `_subject_version_ids`'s `.eq("user_id").eq("filename")` read. Do it as ONE batched read over the candidates' `(user_id, filename)` pairs, never one read per row.

---

### `backend/app/services/document_view_resolver.py` (MODIFY: extract `apply_fragments`)

**Source:** lines 254-318 (`def _apply(q)` closure inside `resolve_filter`). Move the body to module level without rewriting it:
```python
def apply_fragments(q, fragments, subtree=None):
    for frag in fragments:
        if frag.leg == "containment":
            q = q.contains("metadata", {frag.field: frag.value})
            continue
        ...  # lines 275-314 verbatim
    if subtree:
        q = q.in_("folder_id", subtree)
    return q
```
Then `resolve_filter` uses `def _apply(q): return apply_fragments(q, fragments, subtree)`. **Guard:** run `tests/unit/test_115_resolver_extraction.py` plus every `tests/integration/test_113_*` and `test_114_*` before and after; their results must be identical. ⛔ `resolve_filter`'s contract stays as is: latest only, `created_at desc`, D-113-5 drop. Saved views, `resolveAdHoc` and the Phase 115 agent tool depend on it.

---

### `backend/app/models/document_search.py` (model, request)

**Analog:** `backend/app/models/document_view.py` (110 lines).

**Closed `Literal` as the reject-unknown layer** (lines 34-64):
```python
class ViewCondition(BaseModel):
    field: str
    op: Literal["eq", "gte", "lte", "one_of", "contains", "is_empty",
                "within_next", "older_than", "before", "after", "between"]
    value: str | int | float | bool | None = None
    value2: str | int | float | None = None
    values: list[str | int | float] | None = None
    unit: Literal["days", "weeks", "months"] | None = None
```
**Request body shape** (lines 95-110, `AdHocResolve`): `filter_expr: ViewFilter` plus optional fields. The Find request reuses `ViewFilter` for metadata conditions and adds `name: str | None` (`max_length=200`), `folder`, `added_by`, `dates`, `relationship`, `version: Literal["latest","has_earlier","older"] = "latest"`, a 6-member `sort` Literal, `offset: int >= 0`, and `limit: int` with bounds 1..100 and default 25. **Add `model_config = ConfigDict(extra="forbid")`**. The analog does not have it, and RESEARCH §Security V5 requires it. Use `UUID` for every id.

**No response_model** (docstring lines 17-24, the 112 CR-01 lesson). Return a plain dict so rows keep their exact `metadata` blob (`_source` / `_confidence`).

---

### `backend/app/api/document_search.py` (route, request-response)

**Analog:** `backend/app/api/document_views.py:263-300` (`resolve_adhoc`).

**Imports + router** (lines 47-50, 74):
```python
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.dependencies import get_current_user, get_user_supabase_client
router = APIRouter(prefix="/document-views", tags=["document-views"])
```
New router: `APIRouter(prefix="/document-search", tags=["document-search"])`.

**Thin wrapper with error remap** (lines 291-300). Copy exactly:
```python
@router.post("/resolve")
async def resolve_adhoc(
    body: AdHocResolve,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    try:
        return await resolve_filter(caller=current_user["id"], flt=body.filter_expr, ...)
    except ResolveError as e:
        raise HTTPException(status_code=e.status, detail=e.detail)
```
The user-JWT client (`get_user_supabase_client`) keeps RLS in force. No audit write and no DB write: the endpoint is safe to call per keystroke, like the analog. Module docstring style: follow `backend/app/api/library.py:1-29`, which explains why it is its own module ("Deliberately NOT in api/documents.py").

---

### `backend/app/main.py` (MODIFY)

**Analog:** lines 879 and 896:
```python
app.include_router(document_views.router)  # Phase 113 VIEW-01/02 — virtual-folder views CRUD + per-viewer resolve
app.include_router(library.router)  # Phase 217.1 (BE-2 / D-217.1-27) — ... Deliberately NOT in api/documents.py ...
```
Add one line with a trailing provenance comment. Place it after `document_views.router`. `/document-search` collides with no prefix.

---

### `backend/tests/unit/test_271_search_core.py` (unit, fake builder)

**Analog:** `backend/tests/unit/test_116_handler.py:51-118`:
```python
class _FakeQuery:
    def __init__(self, table, recorder):
        self._table = table; self._rec = recorder
    def select(self, *a, **k): return self
    def eq(self, col, val):
        self._rec.setdefault("eqs", []).append((self._table, col, val)); return self
    def in_(self, col, vals): return self
    def ilike(self, col, pat):
        self._rec.setdefault("ilikes", []).append((self._table, col, pat)); return self
    def execute(self):
        return _FakeResult(self._rec.get("_canned", {}).get(self._table, []))

class _FakeClient:
    def __init__(self, recorder): self._rec = recorder
    def table(self, name): return _FakeQuery(name, self._rec)
```
Extend the recorder to log `in_`, `is_`, `gte`, `lt`, `range`, and `select(count=...)`, so each structure applier is asserted by its exact builder calls. Also return a `.count` on the fake result. Pair every applier test with one "applier removed → test RED" drive (RESEARCH "Key insight").

---

### `backend/tests/unit/test_271_no_embedding.py` (static + patched fence)

**Analogs:**
- `backend/tests/unit/test_115_resolver_extraction.py:30-40`, the module-surface assertion:
  ```python
  import app.services.document_view_resolver as m
  assert not hasattr(m, "HTTPException"), "resolver must not import FastAPI HTTPException"
  ```
  For the new core, assert no `embed_texts`, `embed_chunks` or `openai_service` attribute, and no `HTTPException`.
- `backend/tests/unit/test_189_no_egress.py` (lines 1-25, plus `_block_all_http` at :84 and `test_the_transport_patch_is_not_inert` at :264). Use its structure: a patch that RAISES (`openai_service.embed_texts` at `openai_service.py:2340`, `embedding_service.embed_chunks` at `:117`, plus every module that imports either name), **plus an inertness control** proving the patch fires when called, plus a source walk asserting `.rpc(` and the embedding module names are absent from the new files, with a positive-control haystack.

---

### `backend/tests/integration/test_271_search_live.py` (live DB, content)

**Analog:** `backend/tests/integration/test_114_resolve_adhoc.py`.
- Skip guard: copy lines 32-63 (`_pg_reachable`, `PG_AVAILABLE`, `pytestmark = pytest.mark.skipif(...)`). A skip is not a pass.
- Fixtures: copy lines 115-176 (`pg_pool` with the jsonb codec, `test_user` / `second_user` with FK-safe teardown).
- Seeder: extend `_seed_doc` (lines 179-189) with `filename`, `folder_id`, `version_number`, `is_latest`, `source_*_at`, `source_connection_id`. Version lineages need a shared `filename` per `(user_id, filename)`.
- Drive the real route coroutine directly (lines 214-226):
  ```python
  from app.api.document_views import resolve_adhoc
  out = await resolve_adhoc(body=AdHocResolve(...), current_user={"id": str(test_user)}, supabase=sb)
  assert out["total"] == 3
  ```
- Assert exact id SETS, not counts (Pitfall 1). Seed one row at `2019-12-31T15:00Z` for the timestamptz day boundary (Pitfall 3).

---

### `backend/tests/integration/test_271_two_org_fence.py` (real RLS fence)

**Analog:** `backend/tests/integration/test_266_two_org_fence.py`.
- Imports (lines 35-40): `from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg` and `from tests.integration.test_163_rls_documents import _add_comember, _drop_user` (verbatim reuse).
- Seed with every org column EXPLICIT and prove it landed (lines 68-102).
- Single-org precondition (lines 121-125, 172-177): `assert await _memberships(pg_pool, fence["s"]) == {fence["org_a"]}`.
- Leg shape with a positive control (lines 180-193):
  ```python
  async with open_user_conn(pg_pool, fence["s"]) as conn:
      await assert_auth_uid(conn, fence["s"])
      s_sees_b = await conn.fetchval(sql, fence["b"]["doc_id"])
  ...
  assert s_sees_b == 0, "LEAK: ..."
  assert s_sees_a == 1, "... the leg is broken, not fenced"
  assert t_sees_b == 1, "positive control ..."
  ```
⚠ Pitfall 8: `open_user_conn` is raw SQL. The Find core runs supabase-py builders, which the `_reembed_adapter` does not support (`in_`, `ilike`, `is_`, `gte`, `lt`, `range`, `count`). The plan must choose: extend the adapter (test-only, with its own unit test), or sign in seeded users through GoTrue at :54321 and call the core with a real user-JWT client. Record the choice as a decision.

---

### `frontend/src/pages/findState.ts` (pure reducer leaf)

**Analog:** `frontend/src/pages/librarySelection.ts` (312 lines).

Copy the following structure exactly:
- **Docblock sections** (lines 1-72): WHY, "A STRICT LEAF" (zero imports, no React, no fetch, no storage), and "WHAT THIS MODULE CANNOT PRODUCE". Name the async results excluded from it: the Find page result, `total`, `older_matches`, and the request id.
- **Structural "Like" types instead of imports** (lines 79-89) for the `ViewFilter` shape.
- **`readonly` state interface + `initial…State`** (lines 118-150). Defaults: mode `"find"` (not persisted, S5), version `"latest"`, sort `"added_desc"`, offset `0`, name `""`, no structure conditions.
- **Discriminated action union + total reducer with a `default: return state`** (lines 159-278).
- **Derived accessors, never stored** (lines 299-312). For example `isSearchActive(state, filter)`, which is true when the name is non-empty, a condition is set, or the version is not "latest" (UI-SPEC S4), and `canSaveAsView(state)` (Pitfall 9: name, folder, relationship, version, added-by and the 3 file dates are all unstorable).

⛔ Do NOT add actions to `librarySelection.ts`. Its suite pins the action set at six. Compose at the page boundary instead (see LibraryPage below).

### `frontend/src/pages/__tests__/findState.test.ts`

**Analog:** `librarySelection.test.ts:36` (`import librarySelectionSource from "../librarySelection.ts?raw"`) and the strict-leaf fence at lines 550-566:
```ts
it("has zero import statements", () => {
  expect(librarySelectionSource.length).toBeGreaterThan(2000)
  expect(librarySelectionSource).toContain("export function libraryReducer")
  const importLines = librarySelectionSource.split(/\r?\n/).filter((line) => /^import\b/.test(line))
  expect(importLines).toEqual([])
})
it("performs no I/O and holds no component state", () => {
  for (const token of ["useState", "useEffect", "useRef(", "fetch(", "localStorage"]) {
    expect(librarySelectionSource).not.toContain(token)
  }
})
```
Adopt it into BOTH vitest gate knobs (TARGETS and BASELINE).

---

### `frontend/src/hooks/useDocumentFind.ts` (hook, debounced request sequencing)

**Analog A, debounce + stale guard:** `FilterBar.tsx:94-131`:
```ts
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const reqIdRef = useRef(0)
useEffect(() => {
  if (timerRef.current) clearTimeout(timerRef.current)
  const myReq = ++reqIdRef.current
  setCounting(true)
  timerRef.current = setTimeout(() => {
    resolveFilterCount({ op: "and", conditions })
      .then((total) => { if (myReq === reqIdRef.current) setCount(total) })
      .catch(() => { if (myReq === reqIdRef.current) setCount(null) })
      .finally(() => { if (myReq === reqIdRef.current) setCounting(false) })
  }, debounceMs)
  return () => { if (timerRef.current) clearTimeout(timerRef.current) }
}, [JSON.stringify(conditions), debounceMs, externalCount])
```
300 ms is the shipped constant (UI-SPEC: name input debounce).

**Analog B, list resolve:** `LibraryPage.tsx:438-460` (`resolveFilterIntoList`). ⛔ **Copy everything except the catch.** That catch is:
```ts
} catch {
  if (myReq === filterReqId.current) {
    setFilteredDocs(null)   // ← swaps in the UNFILTERED folder list (UI-SPEC S7 forbids)
    setMatchCount(null)
  }
}
```
Find's catch must set an `error` state and KEEP the previous rows and chips. Also return a `loading` flag (the S7 "Searching…" state, rows kept at `opacity-60 aria-busy`). Resting Find (no active search) makes **zero** requests, which keeps every LibraryPage mount suite green.

---

### `frontend/src/lib/api/documents.ts` (MODIFY: `searchDocuments`)

**Analog:** `frontend/src/lib/api/knowledge.ts:293-305`:
```ts
export async function resolveAdHoc(filter_expr: ViewFilter, opts: { count_only?: boolean } = {}) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views/resolve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ filter_expr, count_only: opts.count_only ?? false }),
  })
  if (!res.ok) throw new Error("Failed to resolve filter")
  return res.json() as Promise<{ documents?: Document[]; total: number }>
}
```
`documents.ts:25` already imports `API_BASE, getAuthHeaders` from `./_core`. Throw an error that carries `status` (the `DownloadError` precedent at `documents.ts:129-136`, or `ApiError` from `_core`), so a 422 can be told apart from a network failure. ⛔ **Do not add it to the `lib/api.ts` barrel.** Consumers import from `@/lib/api/documents`. Otherwise every `vi.mock("@/lib/api", factory)` missing the export throws at mount (the 196-08 lesson).

---

### `frontend/src/components/library/find/FindModeSwitch.tsx` (component)

**Analog:** `LibraryHeaderBar.tsx:119-169`, the segmented-control track:
```tsx
<div role="tablist" className="flex gap-0.5 rounded-lg border border-border/60 bg-card/60 p-0.5">
  <button type="button" role="tab" aria-selected={tab === value}
    className={cn("relative rounded-md px-3 py-1 text-xs transition-colors",
      tab === value ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>
```
**Deliberate differences (UI-SPEC):** `role="radiogroup"` with `aria-label="Search mode"`, and `role="radio"` + `aria-checked` on each segment. Track padding `p-1` (not `p-0.5`). The selected segment is `bg-primary/15 text-primary` (not `bg-accent`). Roving Left/Right arrows. Below 768px each segment is `min-h-[44px]`. ⛔ Do not use `role="tab"` here: a second tablist would collide with the 41+ `getByRole("tab", {name})` cases (LibraryHeaderBar lines 113-118).

### `frontend/src/components/library/find/FindMetaLine.tsx` (component)

**Analog:** `FilterBar.tsx:240-256` for the count span (`tabular-nums`, zero styling, `data-testid`). Count words: `"{N} documents" · "1 document" · "0 documents"`. Zero uses `text-warning`, not the shipped `text-amber-500`. **Sort select:** shadcn `Select` exactly as imported in `DocumentsPager.tsx:14-20`, with `h-8 text-xs` and `aria-label="Sort results"`. The count is `aria-live="polite"`. FilterBar's own count is suppressed in Find mode (one count on screen).

### `frontend/src/components/library/find/AskHandoffCard.tsx` (component)

**Card/state idiom:** `ClassificationRulesPage.tsx:154` (`rounded-xl bg-card/50 ghost-border`). UI-SPEC uses `p-6 space-y-3` with a Manrope `text-lg font-semibold` title. **Handoff contract:** the card takes `onAskInChat(question)` as a prop and does no I/O. ChatLayout implements it (see below). The button is disabled while the input is empty, and Enter does the same as the button.

### `frontend/src/components/library/find/*Popover.tsx` (Folder, Relationship, Version, AddedBy, Date)

**Analog:** `ConditionPopover.tsx:199-238`:
```tsx
<div className="w-72 rounded-lg border border-border bg-popover p-3 shadow-md space-y-3"
     role="dialog" aria-label="Edit condition">
  <label className="block space-y-1">
    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Field</span>
    <select aria-label="Field" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring">
```
UI-SPEC deltas: new popovers use `text-xs` section headings (12px, not `text-[10px]`). Esc closes and returns focus to the chip. Anchor with FilterBar's `absolute left-0 top-full z-20 mt-2` (FilterBar line 300). The Date popover reuses `RelativeDateControl` (`ConditionPopover.tsx:4`) and adds the "Which date" choice with the four 270 labels verbatim. The Relationship popover mounts `LinkTargetCombobox` (below). The Added-by options use the 270 vocabulary (see DocumentRow).

### `frontend/src/components/relationships/LinkTargetCombobox.tsx` (EXTRACTED)

**Source:** `CreateLinkDialog.tsx:206-275`, plus its state and handlers at lines 64-132 (`query`, `activeIndex`, `listboxId`, `filtered`, `choose`, `onInputKeyDown`). Move the input with `role="combobox"` (`aria-expanded`, `aria-controls` only while visible (WR-04), `aria-activedescendant`, `aria-autocomplete="list"`) and the `<ul role="listbox">` / `<li role="option" onMouseDown={e => { e.preventDefault(); choose(d) }}>` body. Props: `candidates`, `excludeIds`, `value`, `onChoose`, `placeholder`. The dialog keeps the rel-type chips, the exclusion note, the preview and the footer. Find passes the placeholder `Type a document name`, latest-version candidates only, and up to 8 shown. ⚠ `CreateLinkDialog.test.tsx` is in **neither** vitest knob (RESEARCH Wave 0). Adopt it into both before the extraction, or a regression stays invisible.

### `frontend/src/components/relationships/relationshipLabels.ts` (MODIFY)

**Self-analog** (lines 19-43). Derive the 8-verb filter table from the existing maps. Do not retype it:
```ts
export const OUTGOING_LABEL: Record<RelType, string> = { supersedes: "Supersedes", ... attached_to: "Attached to" }
export const INCOMING_LABEL: Record<RelType, string> = { supersedes: "Superseded by", ... attached_to: "Has attachment" }
export const REL_TYPES: RelType[] = ["supersedes", "amends", "references", "attached_to"]
```
⚠ The UI-SPEC verb copy is NOT byte-equal to these maps. It reads "Is superseded by", "Is amended by", "Is referenced by", and "Is attached to" (OUTGOING says "Attached to"). The derivation therefore needs one stated transform: prefix "Is " to `INCOMING_LABEL` for the three `*_by` keys, and to `OUTGOING_LABEL.attached_to`. Pin the full derived table with a test, so a change to either map shows up there. Keys must equal backend `_INVERSE_LABEL` keys plus values (`document_relationship_service.py:56-61`).

---

### `frontend/src/components/ingestion/FilterBar.tsx` (MODIFY)

**Self-analog.** Add three optional props. With none passed, the Views tab must render byte-identically:
1. `quickAdd?: ReactNode`, a row rendered after `<span>Where</span>` (line 204) and before the `+ condition` button (lines 231-237).
2. `suppressCount?: boolean`, which gates the `match-count` span (lines 241-256).
3. `saveDisabledReason?: string`, rendered as muted text **instead of** the Save-as-view button (lines 259-294) when set.

Set chips keep the shipped neutral markup (lines 208-227: `rounded-full border border-border bg-card`, ✕ with `aria-label={`Remove condition ${i + 1}`}`). The UI-SPEC deviation table forbids an indigo wash.

### `frontend/src/components/ingestion/ConditionPopover.tsx` (MODIFY)

**Pitfall 1 (pre-existing defect):** lines 118-134 merge `WATCH_FIELDS` (`name`, `type`, `size`) into the non-watch picker:
```ts
for (const f of [...BUILTIN_FIELDS, ...WATCH_FIELDS, ...custom]) {
```
None of these is in the resolver whitelist (`_METADATA_BUILTINS ∪ _SOURCE_FACT_FIELDS`, resolver lines 124-141), so they 422. In Find mode, filter the list to the server whitelist (for example via an optional `allowedFields?: ReadonlySet<string>` prop). Add a test that every offered field resolves. Leave the `ruleScope === "watch"` arm untouched (the rules surface depends on it). ⚠ `ConditionPopover.test.tsx` is in neither vitest knob. Adopt it first.

### `frontend/src/components/ingestion/DocumentList.tsx` / `DocumentRow.tsx` (MODIFY: Find column set)

**Shed invariant, do not break:** `DocumentList.tsx:143-151` has seven `<th>` (chevron / Filename / Type / Size / Chunks / Status / Actions). `DocumentRow.tsx:331-410` has seven `<td>`. Find swaps positions 3-5 to Document type / Added by / *Date*, behind a prop such as `columns?: "browse" | "find"`. Browse stays byte-identical. `SHED_COLUMNS_3_TO_5` (`LibraryPage.tsx:107-108`) is **not edited**. Its selector excludes `table[data-version-history]` (270-05 F-1).

**Name-cell second line:** extend the shipped folder pill block (`DocumentRow.tsx:380-389`, `showFolderPill && folderName`) into a `text-xs text-muted-foreground` line carrying the path and the version tag. It lives inside `<td>` 2, so it survives the shed.

**Added by:** `DocumentFileFacts.tsx:32-43` `addedBy()` is **module-private**. Export it, or move it to a pure helper both files import. Do not copy it (connection first, never an email, 270 F-2 / P-02):
```ts
function addedBy(doc: Document, currentUserId?: string): string {
  if (doc.source_connection_id) {
    return doc.source_connection_name ? `${doc.source_connection_name} (connected source)` : "a connected source"
  }
  if (currentUserId && doc.user_id === currentUserId) return "You"
  return "name not available"
}
```
**Date cell "not recorded":** `DocumentFileFacts.tsx:14-16` `NotRecorded` (italic, muted). It is also module-private, so share it the same way.

**Chevron divergence (record, do not fix):** `DocumentRow.tsx:54-56` `hasVersions = (doc.version_number ?? 1) > 1`. The server's `has_earlier` uses the lineage definition (RESEARCH Open Question 3).

### `frontend/src/components/library/DocumentsPager.tsx` (REUSE)

Props (lines 29-37): `{ total, offset, limit, onChange }`. ⚠ **Hazard found while mapping:** lines 24-25 and 45-46 hold an honest arm, `const capped = total >= ROW_CAP` (1000), which renders "list may be larger". In Find the total is the server's EXACT count, so ≥1000 would be mislabelled as uncertain. Add an optional `exact?: boolean` that bypasses the cap arm, or pass the server total through a dedicated path. Either way, browse behaviour stays unchanged.

---

### `frontend/src/pages/LibraryPage.tsx` (MODIFY, G-5 FIRES)

**Compose at the page boundary, the established seam** (lines 140-150):
```ts
type PageAction =
  | LibraryAction<ViewFilter, SavedView>
  | { type: "SET_FOLDER_SHEET"; open: boolean }
function pageReducer(state: LibState, action: PageAction): LibState {
  if (action.type === "SET_FOLDER_SHEET") return { ...state, folderSheetOpen: action.open }
  return libraryReducer<ViewFilter, SavedView>(state, action)
}
```
Find state is a SECOND `useReducer(findReducer, initialFindState)` beside it, not a new `PageAction`. Filing-rules sub-view state is `useState<{ open: boolean; originTab: LibraryTab }>` (RESEARCH Pattern 5: Library-local, not a selection action).

**Lead swap, the ledger's named seam** (lines 613-620 + 639-640):
```tsx
// ⭐ ONE definition, mounted by the Documents tab and the Views tab. `lead` is the only
// thing that differs between them, which is what keeps the tab shell from becoming the
// tenth conditional branch inside this component (the ledger's named seam for this file).
const documentSurface = (lead: ReactNode) => ( ... {lead}{filterBarEl} ... )
```
Find mode passes a lead of search row + chip strip, and hides `documentsLead` (lines 687+) while a search is active (UI-SPEC S4). Prefer a `DocumentsFindBody` child component owning the Find render, so LibraryPage only wires props (G-5).

**`handleFilterChange` routing** (lines 487-490): on the Documents tab it must feed the Find request (via `useDocumentFind`), not `resolveFilterIntoList`. On Views it stays as shipped.

**Paging** (lines 570-571): `pagedDocuments = filteredDocs !== null ? listDocuments : listDocuments.slice(...)`. Find must not slice client-side. Its page is the server page.

**Selected doc** (lines 340-343) resolves only from `documents`:
```ts
const selectedDoc = useMemo(
  () => (selectedDocId === null ? null : documents.find((d) => d.id === selectedDocId) ?? null),
  [selectedDocId, documents],
)
```
Extend it to also look in the Find page rows. An older-version row is never in `documents` (Pitfall 6 / UI-SPEC S4).

**Header mount** (lines 826-838). Add `onOpenFilingRules` to `<LibraryHeaderBar … />`. Keep the `${tab}-pagehead` wrapper and the `subtitle` literal unchanged: `renameFence.test.ts` reads that literal out of this file.

### `frontend/src/components/library/LibraryHeaderBar.tsx` (MODIFY)

**Self-analog.** The right cluster is currently just the pill, carrying `ml-auto` (lines 173-184):
```tsx
<button type="button" data-testid="library-queue-pill" ...
  className={cn("ml-auto flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors", ...)}>
```
Wrap it in `<div className="ml-auto flex items-center gap-2">`, move `ml-auto` off the pill, and put the Filing rules link FIRST. Link class per UI-SPEC S1: `text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border rounded-md px-2 py-1`, with `Wand2` + label + `ChevronRight` at h-3.5 w-3.5. Below 768px it is icon-only with `aria-label` and Tooltip. Add the prop with a docblock in the style of `attention?` (lines 57-70). ⛔ The tablist (lines 119-169) is untouched, and the link is not a `role="tab"`.

### `frontend/src/components/classification/ClassificationRulesPage.tsx` (MODIFY)

**Self-analog.** Add `embedded?: boolean`. Embedded drops the outer padding and the h1 block (lines 124-134):
```tsx
<div className="flex h-full flex-col overflow-hidden p-8">
  <div className="mb-6 flex items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-headline font-bold text-foreground">Classification rules</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Suggest a folder for matching uploads — never a silent move. ...</p>
```
In embedded mode the sub-view header (Back "Library" + title "Filing rules" + subtitle + New rule) is rendered by the Library. Either lift `handleNewRule` through a prop, or render the header inside the component behind `embedded`, so **New rule** stays the single primary action. Rename "Classification rules" → "Filing rules". Keep the subtitle verbatim. Rules list, scope filter, builder grid and states (lines 146-244) stay byte-identical. Update the docblock line 7 ("App.tsx ActiveView 'classification-rules'"), which becomes stale. Its own `useIsMobile` (lines 33-46) duplicates LibraryPage's: leave it, out of scope.

### `frontend/src/components/classification/RuleBuilderPanel.tsx` (MODIFY)

Line 287: `<span className="text-xs font-semibold">After extraction (Classification)</span>` → `After extraction`. Update any matching assertion in `RuleBuilderPanel.test.tsx` (BASELINE 8) in the same commit.

### `frontend/src/lib/nav-items.ts` + `nav-items.test.ts` (MODIFY)

Remove lines 38-41:
```ts
// Phase 118 gap-closure (CLASS-01 reachability): the classification-rules
// top-level home ...
{ view: "classification-rules", icon: Wand2, label: "Classification" },
```
Drop `Wand2` from the line-15 import (it moves to `LibraryHeaderBar`). ⚠ Line 131's comment names "Classification" in a quoted operator report. That is history, so leave it. **Re-pin** `nav-items.test.ts:55-60` (`expect(NAV_ITEMS.length).toBeGreaterThanOrEqual(8)`) to 7, with the reason in the test body in the file's own style (lines 56-58 already explain a count). Do not delete the case: the count gate pins this file at 5, and a deletion reads as a DECREASE.

### `frontend/src/App.tsx` (MODIFY)

Line 127: remove `"classification-rules"` from the `ActiveView` union. `renameFence.test.ts:142` asserts `>= 10`; 12 remain.

### `frontend/src/components/layout/ChatLayout.tsx` (MODIFY, G-5 FIRES)

**Retire:** the import at line 23 and the branch at lines 943-948 (`activeView === "classification-rules" ? (… <ClassificationRulesPage />)`), together with App.tsx:127 and nav-items in ONE commit. `activeViewReachability.test.ts` re-reads all three files and fails on a member without a branch or a branch without a member. Do not touch the trailing `UnknownViewFallback` (lines 1093-1094).

**Add `onAskInChat`.** The analog is lines 279-282:
```ts
const handleTryInChat = useCallback((skillName: string) => {
  onSetPrefillMessage(`Use the ${skillName} skill`)
  onNavigate("chat")
}, [onSetPrefillMessage, onNavigate])
```
⚠ That analog does NOT create a thread, and copying it is G-4 #4's failure. The order to copy is `startScopedChat.ts:56-80` / ChatLayout 1072-1090: `await newThread()` (`useThreads.ts:43-48` creates, prepends and selects), THEN `onSetPrefillMessage(q)`, THEN `onNavigate("chat")`. Add a try/catch that logs and does not navigate on failure (lines 1085-1090 precedent). `MessageInput.tsx:385-389` consumes and clears the prefill. Drive it live (A5: draft restore on the new thread). Pass it at the mount on line 905: `<LibraryPage onNavigate={onNavigate} initialTab={libraryTab} attentionConditions={attentionConditions} onAskInChat={handleAskInChat} />`. ⚠ `renameFence.test.ts` asserts the `activeView === "documents" ? (<LibraryPage` link inside a 120-character window (lines 898-903). Keep the mount on one line, with nothing between the branch and the mount.

### `frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx` (MODIFY)

Line 396: remove `"classification-rules",` from the non-Library destination list (it would be a dead string).

---

## Shared Patterns

### Async I/O in handlers (D-v2.5-01)
**Source:** `backend/app/utils/db.py:47` `aexec(query)`. **Apply to:** every supabase-py call in `document_search_service.py`. Pattern: `(await aexec(builder)).data or []`.

### User-JWT RLS client + auth
**Source:** `backend/app/dependencies.py:300` (`get_current_user`), `:395` (`get_user_supabase_client`). **Apply to:** `api/document_search.py`. Never use the service-role `get_supabase()` on this read path. `document_relationship_service._client(None)` defaults to service role, so always pass the route's `supabase` explicitly into `_resolve_readable_latest` / `_subject_version_ids`.

### Core raises a plain error; the route remaps
**Source:** `document_view_resolver.ResolveError` (lines 49-62) + `document_views.py:259-260` / `:299-300`. **Apply to:** service + router.

### No existence oracle
**Source:** `document_views.py:235-239` (404-not-403) and `_resolve_readable_latest` returning `None` (line 237). **Apply to:** the relationship picker. An unreadable picked document returns the SAME zero-result response shape as "no matches".

### Values bound, never interpolated (SC#4)
**Source:** resolver lines 298-302 (`.in_` quotes members). **Apply to:** name `ilike` (escape `\ % _` before wrapping in `%…%`), id allow-lists (`.in_`), every date bound. Never build `.or_()` from user strings.

### Frontend API client module
**Source:** `lib/api/knowledge.ts:293-305`, `lib/api/documents.ts:143-157`. **Apply to:** `searchDocuments`. Pattern: `getAuthHeaders()` → `fetch(`${API_BASE}/…`)` → status-carrying error → typed `res.json()`. Use the module, never the barrel.

### Honest states (loading ≠ error ≠ empty)
**Source:** `ClassificationRulesPage.tsx:155-177`:
```tsx
<div role="status" aria-live="polite" ...>Loading rules…</div>
<div role="alert" ...><p className="text-sm text-destructive">Couldn&rsquo;t load your rules.</p>
  <button ... className="text-xs text-primary hover:underline ...">Try again</button></div>
```
**Apply to:** Find results (S7). The difference: Find's error keeps the query, every chip and the previous rows. It never swaps to the folder list.

### Pure leaf + boundary composition
**Source:** `librarySelection.ts` + `LibraryPage.tsx:140-150` (`pageReducer`) + `:191-205` (the "composed HERE, not in the leaf" docblock). **Apply to:** `findState.ts`, the Filing rules sub-view state, and the Find mode.

### One builder, never a fork (D-114-1 / D-115-6)
**Apply to:** FilterBar (optional props, Views byte-identical), the CreateLinkDialog combobox (extract, never copy), `apply_fragments` (extract, never copy), `relationshipLabels` (derive, never retype), `addedBy` / `NotRecorded` (export, never copy).

### G-5 ledger rows (gate-enforced)
`node scripts/check-hot-file-ledger.cjs <phase-dir>` fails on any `files_modified` source file without a row. RESEARCH measured **8 probable files with NO row**: `api/document_views.py`, `models/document_view.py`, `services/document_relationship_service.py`, `ingestion/FilterBar.tsx`, `ingestion/viewRuleWords.ts`, `library/DocumentsPager.tsx`, `relationships/CreateLinkDialog.tsx`, `relationships/relationshipLabels.ts`. Each NEW file also needs a row at creation (the `settingsSearchPayload.ts` precedent). Disposition cells are ≤200 chars, and the reasons go in `docs/HOT-FILE-LEDGER.md` in the same commit.

### Vitest gate adoption
Every new suite goes into BOTH knobs of `scripts/vitest-count-gate.cjs` (TARGETS = runs, BASELINE = guarded). `CreateLinkDialog.test.tsx`, `RelationshipsSection*.test.tsx` and `ConditionPopover.test.tsx` are in neither knob today. Adopt them before editing their subjects. Typecheck with `npx tsc -p tsconfig.app.json --noEmit` as a set diff against **70** errors at `56630a65b`.

---

## No Analog Found

| File / concern | Role | Data Flow | Reason / fallback |
|---|---|---|---|
| `has_earlier` batched lineage read (inside `document_search_service.py`) | service step | batch | No shipped code computes "has a lower `version_number` in its lineage" over many rows at once. The nearest shape is `_subject_version_ids` (single row). Fall back to RESEARCH §Definitions + Pattern 2, and a live content test that covers delete and restore. |
| Real-JWT supabase-py RLS fence | test harness | — | `_reembed_adapter` does not speak the Find builder (Pitfall 8). No test yet signs in a GoTrue user to drive a supabase-py core. The plan must choose: adapter extension or GoTrue sign-in. |

## Hazards Surfaced During Mapping (not in RESEARCH)

1. **`DocumentsPager` ROW_CAP arm** (`DocumentsPager.tsx:24-25, 45-46`) would mislabel an exact server total ≥1000 as "may be larger". Find needs a bypass.
2. **`addedBy` and `NotRecorded` are module-private** in `DocumentFileFacts.tsx` (lines 14-16, 32-43). The Find Added-by column must export or share them. A copy would fork the 270 F-2 connection-first rule.
3. **The UI-SPEC verb copy is not byte-equal to `relationshipLabels.ts`** ("Is superseded by" vs "Superseded by"; "Is attached to" vs "Attached to"). The derivation needs one stated, tested transform.
4. **`document_relationship_service._client(None)` falls back to the service-role client** (lines 71-72). Always pass the route's user-JWT client in, or RLS on `document_relationships` stops applying.
5. **`renameFence.test.ts` reads a 120-character window** at ChatLayout lines 898-905. Adding the `onAskInChat` prop must keep `<LibraryPage …` on the branch's next line.

## Metadata

**Analog search scope:** `backend/app/{services,api,models,utils}`, `backend/tests/{unit,integration}`, `frontend/src/{pages,components/{library,ingestion,relationships,classification,metadata,layout,experts/catalog},lib,lib/api,hooks}`
**Files read or grepped:** 31
**Pattern extraction date:** 2026-10-03
