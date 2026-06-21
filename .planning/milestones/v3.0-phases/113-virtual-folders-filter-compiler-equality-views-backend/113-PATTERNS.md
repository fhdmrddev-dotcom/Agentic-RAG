# Phase 113: Virtual Folders — Filter Compiler + Equality Views (Backend) - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 8 (5 source net-new + 1 modified + 2 test groups)
**Analogs found:** 8 / 8 (every file has a strong in-repo analog; RESEARCH.md citations VERIFIED to file:line)

> RESEARCH.md already cited every analog. This document VERIFIED each citation against the live code (no drift found) and extracted copy-pasteable excerpts the planner can hand to executors. The ONE genuinely net-new component is `view_filter_compiler.py` — everything else is a near-verbatim clone of a shipped module.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/view_filter_compiler.py` | service (pure compiler) | transform | `harness/validators.py` (registry) + `harness/freshness.py` (param-bound SQL) | role-match (closed-registry); net-new logic |
| `backend/app/services/document_view_service.py` | service (data-access) | CRUD + request-response | `metadata_field_service.py` | exact |
| `backend/app/api/document_views.py` | route (router) | CRUD + request-response | `api/metadata_fields.py` | exact |
| `backend/app/models/document_view.py` | model (Pydantic AST + req/resp) | transform | `models/metadata_field.py` + `models/document.py` | exact |
| `backend/app/main.py` | config (router mount) | n/a | `main.py:405,422` (metadata_fields mount) | exact |
| `backend/tests/unit/test_113_view_filter_compiler.py` | test (unit, pure) | transform | `tests/unit/test_validator_kinds.py` | exact |
| `backend/tests/integration/test_113_view_*.py` | test (live :54322) | CRUD + request-response | `tests/integration/test_111_metadata_fields_crud.py` | exact |

---

## Pattern Assignments

### `backend/app/services/view_filter_compiler.py` (service, transform — THE net-new component)

This file fuses **two** analogs: the closed-registry mechanism from `harness/validators.py`, and the `$N`-bound-no-f-string parameterization discipline from `harness/freshness.py`. There is no single file to clone — copy the *patterns*, not the file.

**Analog A (registry):** `backend/app/services/harness/validators.py`

**Closed registry + `@register_*` decorator** (`validators.py:62-85` — VERIFIED):
```python
from typing import Awaitable, Callable

# kind -> validator fn  (a CLOSED dict; an unknown kind is never eval'd / dynamically imported)
VALIDATOR_REGISTRY: dict[str, Callable[[dict, dict, object], Awaitable[GateResult]]] = {}

def register_validator(kind: str):
    """Decorator: register a validator under ``kind`` in VALIDATOR_REGISTRY."""
    def deco(fn):
        VALIDATOR_REGISTRY[kind] = fn
        return fn
    return deco
```

**Registration-by-decorator in practice** (`validator_kinds.py:191` — VERIFIED):
```python
@register_validator("citations_required")
async def _validate_citations_required(output: dict, config: dict, ctx) -> GateResult:
    ...
```

**Adapt to the compiler** (113 registers ONLY `eq` + `and`; 114 adds the rest by import side-effect — the "no compiler rewrite" payoff of D-113-6):
```python
# OPERATOR_REGISTRY: op -> fn(field, value) -> partial metadata_filter contribution
OPERATOR_REGISTRY: dict[str, callable] = {}

def register_operator(op: str):
    def deco(fn):
        OPERATOR_REGISTRY[op] = fn
        return fn
    return deco

@register_operator("eq")
def _op_eq(field, value):
    # eq contributes {field: value} to the metadata_filter jsonb (bound as $1::jsonb).
    return {field: value}
# 114 ADDITIVELY: @register_operator("one_of") / ("gte") / ... — eq & the AST shape are untouched.
```

**Fail-closed on an unknown op** (mirrors `validators.py` "unknown kind raises, never eval'd"):
```python
def compile_filter(flt) -> dict:
    """Resolve-time: fold eq conditions into ONE metadata_filter jsonb (AND-of-keys)."""
    mf: dict = {}
    for c in flt.conditions:
        fn = OPERATOR_REGISTRY.get(c.op)        # closed lookup; unknown -> None
        if fn is None:
            raise KeyError(f"operator {c.op!r} not registered")   # FAIL CLOSED
        mf.update(fn(c.field, c.value))         # eq -> {field: value}
    return mf                                   # {} when empty -> caller skips .contains() (D-113-9)
```

**Analog B (parameterization discipline):** `backend/app/services/harness/freshness.py:43-71` (VERIFIED) — the in-repo proof that *all literals bind as `$N`, never f-string SQL*:
```python
# Source: harness/freshness.py — SECURITY T-102-03-05: $N placeholders ONLY, NEVER f-string SQL
row = await pool.fetchrow(
    """
    SELECT max(created_at) AS newest
    FROM documents
    WHERE folder_id = ANY($1::uuid[])
    """,
    list(folder_ids),                  # the value rides as a bound param, never concatenated
)
```
For the compiler's `eq`-only path the equivalent binding is the supabase-py `.contains("metadata", mf)` call (see the resolve excerpt below) — `mf` is JSON-serialized and bound as one `$1::jsonb`. **No `eval`, no string interpolation of field names OR values** (SC#4).

**Field-whitelist validation at SAVE** (D-113-8/-10; the `_`-prefix exclusion mirrors `documents.py:1401`, VERIFIED):
```python
def validate_fields(flt, whitelist: set[str]) -> None:
    """Save-time validation (D-113-10). Raises ValueError (->422) on unknown / _-prefixed field."""
    for c in flt.conditions:
        if c.field.startswith("_"):                       # D-111-9 / D-112-D02 invariant
            raise ValueError(f"field {c.field!r} is not filterable (reserved prefix)")
        if c.field not in whitelist:
            raise ValueError(f"unknown filter field {c.field!r}")
```

**Whitelist source assembly** — built-ins ∪ enabled custom defs (own+global), `_`-excluded:
- Built-ins: `set(DocumentMetadata.model_fields)` — exactly how `documents.py:1355` builds `_METADATA_BUILTINS` (VERIFIED): `_METADATA_BUILTINS = set(DocumentMetadata.model_fields)` → `{title, author, date, document_type, topics, language, summary}`.
- Custom: enabled defs from `metadata_field_service.list_field_definitions(caller, supabase)` (own+global, already deduped — `metadata_field_service.py:34-52`). The compiler/router collects `{d["field_key"] for d in defs if d.get("enabled")}`.
- Edge: `documents.py:1409` shows the exact built-in-OR-custom check the save path mirrors: `if field not in _METADATA_BUILTINS and field not in enabled_custom: raise HTTPException(422, ...)`.

**Side-effect registration seam** (for 114): mirror `harness/__init__.py:22-27` (VERIFIED) — `from . import validator_kinds  # noqa: E402,F401` populates the registry at import. For 113 the `eq`/`and` ops live in the same module as the registry, so no separate import is needed; just leave the seam so 114 can add `from . import view_operators_extra` once.

---

### `backend/app/services/document_view_service.py` (service, CRUD + resolve)

**Analog:** `backend/app/services/metadata_field_service.py` (clone almost verbatim)

**Module docstring + `aexec` discipline + `_client` helper** (`metadata_field_service.py:1-31` — VERIFIED). Copy the security-invariant header and the optional-client pattern:
```python
from supabase import Client
from app.dependencies import get_supabase
from app.utils.db import aexec

_TABLE = "document_views"

def _client(supabase: Client | None) -> Client:
    return supabase if supabase is not None else get_supabase()
```

**create — HARD-SET `is_global=False`** (`metadata_field_service.py:55-85` — VERIFIED; the single most security-load-bearing CRUD clone, D-113-3):
```python
async def create_view(user_id, name, filter_expr, folder_scope=None, supabase: Client | None = None) -> dict:
    client = _client(supabase)
    payload = {
        "user_id": str(user_id),
        "name": name,
        "filter_expr": filter_expr,     # validated AST jsonb (already passed validate_fields)
        "folder_scope": str(folder_scope) if folder_scope else None,
        "is_global": False,             # HARD-SET — never from the caller; RLS WITH CHECK forces it too
    }
    result = await aexec(client.table(_TABLE).insert(payload))
    return result.data[0]
```

**list — own + global, deduped by id** (`metadata_field_service.py:34-52` — VERIFIED):
```python
async def list_views(user_id, supabase: Client | None = None) -> list[dict]:
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE).select("*")
        .or_(f"user_id.eq.{user_id},is_global.eq.true")   # own + global (RLS SELECT shape)
        .order("name")
    )
    seen: set = set(); out: list[dict] = []
    for row in result.data or []:
        if row["id"] not in seen:
            seen.add(row["id"]); out.append(row)
    return out
```

**get_view — own OR global; miss → None (router maps to 404)** (the readability check; D-113-4 404-not-403):
```python
async def get_view(view_id, user_id, supabase: Client | None = None) -> dict | None:
    client = _client(supabase)
    result = await aexec(
        client.table(_TABLE).select("*").eq("id", view_id)
        .or_(f"user_id.eq.{user_id},is_global.eq.true")   # own OR global; not-readable -> empty
    )
    return (result.data or [None])[0]
```

**update / delete — own-scoped, miss → None/False → 404** (`metadata_field_service.py:100-127` — VERIFIED): clone `update_field_definition` / `delete_field_definition` verbatim, swapping `_TABLE`. Both `.eq("id", view_id).eq("user_id", str(user_id))`; an empty `result.data` collapses to `None`/`False` (no existence leak).

> NOTE: update of `filter_expr` must re-run `view_filter_compiler.validate_fields` against the live whitelist BEFORE the DB write (D-113-10 applies on update too), same as create.

---

### `backend/app/api/document_views.py` (route, CRUD + resolve)

**Analog:** `backend/app/api/metadata_fields.py` (clone the router shape + audit write)

**Router declaration + DI + create+audit** (`metadata_fields.py:16-78` — VERIFIED):
```python
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from app.dependencies import get_current_user, get_supabase
from app.services import document_view_service, view_filter_compiler
from app.services.audit_service import write_audit_entry

router = APIRouter(prefix="/document-views", tags=["document-views"])

@router.post("", response_model=ViewResponse, status_code=status.HTTP_201_CREATED)
async def create_view(body: ViewCreate, current_user: dict = Depends(get_current_user),
                      supabase: Client = Depends(get_supabase)):
    # 1. validate the AST fields against the live whitelist (D-113-10 — reject unknown/_ field -> 422)
    whitelist = await _build_whitelist(current_user["id"], supabase)
    try:
        view_filter_compiler.validate_fields(body.filter_expr, whitelist)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    # 2. service hard-sets is_global=False (never from the body)
    created = await document_view_service.create_view(
        user_id=current_user["id"], name=body.name,
        filter_expr=body.filter_expr.model_dump(), folder_scope=body.folder_scope,
        supabase=supabase,
    )
    # 3. fire-and-forget audit (swallows errors; verify the LIVE round-trip in integration test)
    await write_audit_entry(
        user_id=current_user["id"], action_type="view.create",
        metadata={"view_id": created["id"], "name": body.name}, supabase=supabase,
    )
    return created
```

**PATCH/DELETE — 404-not-403 on a cross-user miss** (`metadata_fields.py:81-112` — VERIFIED):
```python
updated = await document_view_service.update_view(current_user["id"], view_id, data, supabase=supabase)
if updated is None:
    raise HTTPException(status_code=404, detail="View not found")    # NEVER 403 — no existence leak
```

**Resolve endpoint — clone `list_documents` + the compiler filter + folder-subtree scope** (`documents.py:535-595` — VERIFIED; this is the per-viewer leak-safe core, VIEW-06):
```python
@router.get("/{view_id}/resolve")
async def resolve_view(view_id: str, current_user: dict = Depends(get_current_user),
                       supabase: Client = Depends(get_supabase)):
    caller = current_user["id"]
    view = await document_view_service.get_view(view_id, caller, supabase=supabase)
    if view is None:
        raise HTTPException(status_code=404, detail="View not found")   # 404-not-403 (D-113-4)

    # compile the saved AST -> metadata_filter jsonb dict ({} when empty -> no narrowing, D-113-9)
    flt = ViewFilter.model_validate(view["filter_expr"] or {"op": "and", "conditions": []})
    metadata_filter = view_filter_compiler.compile_filter(flt)

    # resolve folder_scope to a subtree LIST (never a set — Pitfall 1); unreachable -> None (D-113-5)
    subtree = None
    if view.get("folder_scope"):
        subtree = await resolve_project_subtree(view["folder_scope"], supabase=supabase, user_id=caller)
        # if the caller can't see that folder, resolve_project_subtree returns [] / a list lacking
        # caller-visible ids -> the AND-with-subtree naturally narrows to the caller's matches;
        # an empty/None subtree => no narrowing (D-113-5).

    # ---- CALLER-SCOPED listing (clone list_documents) — scope from CALLER, NEVER view.user_id ----
    def _apply(q):
        if metadata_filter:                          # D-113-9 empty -> skip
            q = q.contains("metadata", metadata_filter)   # -> metadata @> $1::jsonb (param-bound)
        if subtree:                                  # VIEW-05
            q = q.in_("folder_id", subtree)          # -> folder_id = ANY($n)  (LIST, never a set)
        return q

    own = _apply(supabase.table("documents").select("*")
                 .eq("user_id", caller).eq("is_latest", True))     # Pitfall 6: is_latest=True
    own_docs = (await aexec(own)).data or []

    global_folder_ids = await get_globally_visible_folder_ids(supabase, caller)  # folder_utils.py:48
    global_docs = []
    if global_folder_ids:
        glob = _apply(supabase.table("documents").select("*")
                      .in_("folder_id", global_folder_ids).eq("is_latest", True))
        global_docs = (await aexec(glob)).data or []

    # merge, dedupe by id, sort created_at desc (clone documents.py:563-570)
    seen: set[str] = set(); merged: list[dict] = []
    for d in own_docs + global_docs:
        if d["id"] not in seen:
            seen.add(d["id"]); merged.append(d)
    merged.sort(key=lambda d: d["created_at"], reverse=True)        # newest-first (D-113-1)
    return {"documents": merged, "total": len(merged)}             # complete listing + count
```

**Imports the resolve route needs** (all VERIFIED present in `documents.py:15,22,24` + `harness/scope.py:51`):
```python
from app.utils.db import aexec
from app.utils.folder_utils import get_globally_visible_folder_ids
from app.services.harness.scope import resolve_project_subtree
```

> WIRING NOTE (RESEARCH §Pattern 2): grep found **zero** existing `.contains()` call sites — the `@>`-over-a-plain-listing wiring is genuinely net-new for the app (`@>` previously lived only inside the two search RPCs). Treat `.contains("metadata", dict)` semantics as a thing to **prove with a live integration test** (RESEARCH A2), not assume.

---

### `backend/app/models/document_view.py` (model, Pydantic AST + req/resp)

**Analog:** `backend/app/models/metadata_field.py` (req/resp shape) + `backend/app/models/document.py:8-49` (`DocumentResponse` for the resolve listing rows)

**AST models — reject-by-parse via `Literal` discriminator** (the anti-eval, anti-dict-walk pattern; mirrors how `metadata_field.py:26` pins `field_type: Literal[...]`):
```python
from typing import Literal
from uuid import UUID
from pydantic import BaseModel

class ViewCondition(BaseModel):
    field: str
    op: Literal["eq"]                       # 113: ONLY eq. 114 widens this Literal additively.
    value: str | int | float | bool         # scalar literal (bound as a param)

class ViewFilter(BaseModel):
    op: Literal["and"]                      # 113: ONLY and (flat AND-of-conditions, D-113-7)
    conditions: list[ViewCondition] = []     # empty = no narrowing (D-113-9)
```
An incoming `filter_expr` with `op: "or"` or a condition `op: "gte"` fails `ViewFilter.model_validate(...)` at save → 422. No `eval`, no manual op-ladder (Pitfall 5).

**Request/response models** (clone `MetadataFieldCreate`/`MetadataFieldResponse` shape, `metadata_field.py:24-69` — VERIFIED):
```python
class ViewCreate(BaseModel):
    name: str
    filter_expr: ViewFilter
    folder_scope: UUID | None = None

class ViewUpdate(BaseModel):
    name: str | None = None
    filter_expr: ViewFilter | None = None
    folder_scope: UUID | None = None

class ViewResponse(BaseModel):
    id: str
    user_id: str | None = None
    name: str
    filter_expr: dict
    folder_scope: UUID | None = None
    is_global: bool = False
```

**Resolve response** — reuse `DocumentResponse` (`models/document.py:30-49` — VERIFIED) for each listing row so the view listing is byte-shape-identical to `GET /documents`:
```python
from app.models.document import DocumentResponse

class ViewResolveResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
```

> CAUTION (the 112 CR-01 lesson, from MEMORY): `DocumentResponse.metadata` is `DocumentMetadata` with `model_config = ConfigDict(extra="allow")` (`document.py:15`). Do NOT tighten that to `extra="ignore"` anywhere in the resolve path — it would strip `_source`/`_confidence` from the rows. The resolve listing must round-trip the same blob `GET /documents` does.

---

### `backend/app/main.py` (config, router mount — MODIFIED)

**Analog:** `main.py:405,422` (the metadata_fields mount — VERIFIED). Two purely-additive lines:
```python
# line ~405 — add to the existing `from app.api import ...` tuple:
from app.api import (..., metadata_fields, document_views)  # noqa: E402

# line ~422 — add after the metadata_fields mount:
app.include_router(document_views.router)  # Phase 113 VIEW-01/02 — virtual-folder views CRUD + resolve
```
No new registration pattern beyond the existing routers.

---

### `backend/tests/unit/test_113_view_filter_compiler.py` (test, unit — pure, no DB)

**Analog:** `backend/tests/unit/test_validator_kinds.py` (VERIFIED — the registry test analog)

Pattern to copy: imports INSIDE each test body (so a not-yet-existing symbol never breaks collection), assert the op is in the registry, then exercise the branch. The compiler is pure → unit coverage of every op/edge is Nyquist-sufficient for the net-new logic (RESEARCH §Sampling Rate). Cover: `test_eq_compiles`, `test_and_folds_conditions`, `test_empty_filter_no_narrowing`, `test_unknown_op_rejected`, `test_unknown_field_rejected_at_save`, `test_underscore_field_excluded`, and the **SC#4 first-class** `test_injection_value_neutralized`:
```python
def test_injection_value_neutralized():
    from app.models.document_view import ViewFilter, ViewCondition
    from app.services.view_filter_compiler import compile_filter
    flt = ViewFilter(op="and", conditions=[
        ViewCondition(field="document_type", op="eq",
                      value="'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}")])
    mf = compile_filter(flt)
    # the payload rides as a JSON literal, never executed / templated:
    assert mf == {"document_type": "'; DROP TABLE documents;-- {{7*7}} ${jndi:ldap://x}"}
```

---

### `backend/tests/integration/test_113_view_*.py` (test, live :54322)

**Analog:** `backend/tests/integration/test_111_metadata_fields_crud.py` (VERIFIED — copy the live-DB harness verbatim)

Copy verbatim (RESEARCH confirms it skips cleanly when :54322 is unreachable, never collection-errors):
- `_POSTGRES_TEST_DSN` + `_pg_reachable` + `PG_AVAILABLE` skipif (`test_111_*.py:23-54`)
- `_read_local_supabase_env()` + `_supabase_or_skip()` (the conftest plants a fake cloud `SUPABASE_URL`, so live tests source the REAL local URL/service-role key from `backend/.env`) (`:65-112`)
- `pg_pool` (function-scoped asyncpg pool with the jsonb codec) + `test_user` (seed throwaway `auth.users`, FK-safe teardown including `DELETE FROM audit_log`) fixtures (`:115-152`)
- the cross-user 404-not-403 assertion shape (`test_update_delete_own_scoped_404_not_403_on_cross_user`, `:204-254`)

Files to author (RESEARCH §Wave 0 Gaps):
- `test_113_view_crud.py` — live CRUD + `view.create` audit row (assert it lands in `audit_log` — the LIVE round-trip is the real verification since the audit service swallows errors) + 404-not-403.
- `test_113_view_resolve.py` — resolve returns the right docs, newest-first, with `total`; one doc resolvable through TWO views (query-not-copy); empty filter → all-in-scope; `is_latest=True` only.
- `test_113_view_folder_scope.py` — live folder-subtree narrowing (analog also: `test_111_flat_filter_compat.py` for the `@>` flat-filter assertion).
- The **two-user cross-user leak test** (SC#3 / VIEW-06) is authored under VALIDATION.md and run in **secure-phase**, not here (the D-102/D-110-5 "static would false-green" lesson).

---

## Shared Patterns

### Closed-registry side-effect registration (the additive-extensibility contract)
**Source:** `harness/validators.py:62-85` (registry + decorator) + `validator_kinds.py:191` (usage) + `harness/__init__.py:22-27` (import side-effect)
**Apply to:** `view_filter_compiler.py` operator/combinator dispatch
**Why load-bearing:** 114 must add `gte`/`lte`/`one_of`/`contains`/`is_empty` by importing an extra ops module ONCE — never by editing the `eq` path or the AST shape (D-113-6 "no compiler rewrite"). An unknown op fails closed (`KeyError`), never `eval`/`getattr`/dynamic-import.

### Bound-literal parameterization — `$N` / `.contains()`, never f-string SQL
**Source:** `harness/freshness.py:43-71` (`ANY($1::uuid[])`) — the in-repo proof
**Apply to:** the compiler's `eq` path → `.contains("metadata", mf)` (= `metadata @> $1::jsonb`) and the `.in_("folder_id", subtree)` (= `folder_id = ANY($n)`)
**Anti-pattern (forbidden, SC#4):** `f"metadata @> '{json}'"` or any string interpolation of a field name OR value.

### `aexec` / `run_in_threadpool` wrap on EVERY supabase call (D-v2.5-01)
**Source:** `app/utils/db.py:32-44` (`aexec` = `run_in_threadpool(query.execute)`); used throughout `metadata_field_service.py`
**Apply to:** every `.execute()` in `document_view_service.py` and the resolve route. Never call `.execute()` directly inside an async handler.

### Owner-scope → 404-not-403 (no existence leak)
**Source:** `metadata_field_service.py:100-127` (miss → None/False) + `api/metadata_fields.py:95-96,110-111` (None → 404) + `documents.py:1391` (404 on owner miss)
**Apply to:** view GET/PATCH/DELETE/resolve. A view id the caller can't see (not own AND not global) → 404, never 403, never a distinct error message that leaks existence.

### Force `is_global=false` on end-user writes (globals are service-role/seed-only)
**Source:** `metadata_field_service.py:62,77` (signature accepts `is_global` for symmetry but the inserted payload HARD-SETS `False`); RLS WITH CHECK at migration 071 forces it too
**Apply to:** `document_view_service.create_view` / `update_view` — never trust a caller-supplied `is_global` (D-113-3).

### `_`-prefix exclusion + built-in∪custom whitelist (D-111-9 / D-112-D02 invariant)
**Source:** `documents.py:1355` (`_METADATA_BUILTINS = set(DocumentMetadata.model_fields)`), `:1401` (`if field.startswith("_"): 422`), `:1403-1410` (built-in OR enabled-custom check); `embedding_service.py:233-296` (`_confidence`/`_source` are DISPLAY-ONLY nested keys; `read_enabled_field_defs` own+global fail-closed)
**Apply to:** `view_filter_compiler.validate_fields` (save-time) — reject `_`-prefixed and unknown fields. `_confidence`/`_source` are NEVER filter dimensions.

### Folder-subtree resolution returns a LIST, never a set (Pitfall 1/2)
**Source:** `harness/scope.py:51-89` (`resolve_project_subtree`: owner-scoped, cycle-guarded IN-01, `None`-in→`None`-out, returns `list[str]`)
**Apply to:** `folder_scope` → `.in_("folder_id", subtree)`. A `set` raises `TypeError` in supabase-py `json.dumps`. Pass the list straight through.

### Audit write — fire-and-forget `view.create`
**Source:** `audit_service.py:57-74` (`write_audit_entry` swallows errors) + `:13-26` (`view.create` already in `VALID_ACTION_TYPES`); usage at `metadata_fields.py:72-77`
**Apply to:** view create. Because the write swallows errors, the LIVE integration test (assert the row lands in `audit_log`) is the real verification — a static check false-greens.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every file has a strong in-repo analog. The `view_filter_compiler.py` *logic* (AST→jsonb fold) is net-new, but its two mechanisms — closed registry + bound-literal SQL — are both cloned from `harness/validators.py` and `harness/freshness.py`. RESEARCH §"Key insight" confirms: the ONLY genuinely-new code is the ~100-line pure compiler; the three CRUD/resolve wrappers clone `metadata_fields.py`/`metadata_field_service.py`/`documents.py:535` near-verbatim. |

> One app-level *wiring* novelty to flag for the planner (not a missing analog): there is **no existing `.contains()` call site** in the codebase (`@>` lived only inside the two search RPCs). The supabase-py `.contains("metadata", dict)` → `metadata @> $1::jsonb` mapping is documented (postgrest 2.29.0, `contains` method VERIFIED present) but unproven in this app — the resolve integration test must assert it live (RESEARCH A2).

## Metadata

**Analog search scope:** `backend/app/services/` (harness/, metadata_field_service, audit_service, embedding_service), `backend/app/api/` (metadata_fields, documents, main), `backend/app/models/` (document, metadata_field), `backend/app/utils/` (db, folder_utils), `backend/tests/{unit,integration}/`
**Files scanned (read or grepped):** 14
**Citation verification:** All RESEARCH.md file:line citations re-read and confirmed accurate (no drift) — `validators.py:62-104`, `validator_kinds.py:191`, `harness/__init__.py:22-27`, `freshness.py:43-113`, `scope.py:51-89`, `documents.py:535-595,1355,1401,1409`, `folder_utils.py:48`, `metadata_field_service.py` (whole), `metadata_fields.py` (whole), `embedding_service.py:233-296`, `audit_service.py:13-26,57-74`, `document.py:8-49`, `metadata_field.py:17,26`, `main.py:405,422`, `db.py`, `test_111_metadata_fields_crud.py`, `test_validator_kinds.py`.
**Pattern extraction date:** 2026-06-18
