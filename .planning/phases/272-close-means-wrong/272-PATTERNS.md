# Phase 272: Close Means Wrong - Pattern Map

**Mapped:** 2026-10-03
**Files analyzed:** 27 (12 source/SQL/frontend files new or modified + 15 test/ledger/gate files)
**Analogs found:** 25 / 27 (2 with partial/research-only patterns: the in-RPC exact-scan branch and the D-11 nearby-values query)

All line numbers below were read at HEAD `a1e85addc` (the working tree the planner sees). Re-read
before quoting in a PLAN if a sibling plan has already landed on the same file.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/retrieval_service.py` (MOD → orchestrator + re-exports) | service | request-response (hybrid retrieval) | itself (pure move) + `retrieval_tuning.py` extraction precedent | exact |
| `backend/app/services/retrieval_rpc.py` (NEW, moved `_vector_literal`/`_call_as_user`/`_vector_search`/`_keyword_search`) | service (DB RPC adapter) | request-response | `retrieval_service.py:27-154` (verbatim source) | exact (move) |
| `backend/app/services/retrieval_rank.py` (NEW, pure `_rrf_fuse`/`_deduplicate_chunks`/`_avg_cosine`) | utility (pure) | transform | `retrieval_service.py:157-275` | exact (move) |
| `backend/app/services/retrieval_documents.py` (NEW, `_enrich_with_filenames`/`resolve_document_id`/`fetch_full_document`) | service | CRUD (read) | `retrieval_service.py:188-380` | exact (move) |
| `backend/app/services/retrieval_scope.py` (NEW, `RetrievalPredicate`/`DEFAULT_PREDICATES`/`resolve_document_scope`) | service | request-response (filter → id set, two-step RLS) | `document_search_service.py:427-471` (`_candidates`) + `retrieval_service._call_as_user:38-78` | role-match (composite) |
| `backend/app/services/search_documents_tool.py` (NEW, handler + arg model + vocabulary + lock + audit + result kinds) | controller (tool handler) | request-response | `tool_dispatcher._handle_search_documents:780-975` (verbatim source) + `_handle_query_documents_by_view:986-1151` (calm-error/ResolveError/catalog) | exact |
| `backend/app/services/tool_dispatcher.py` (MOD: import, registry line, ToolContext field, re-export) | controller (registry) | request-response | `ToolContext.dead_gap_tokens_in_run:121-133`; registry `:4721-4758`; `_ensure_resolver:214-242` | exact |
| `backend/app/services/openai_service.py` (MOD: `SEARCH_DOCUMENTS_TOOL` `filters` arg + vocabulary builder) | config (tool schema) | transform | `QUERY_DOCUMENTS_BY_VIEW_TOOL:106-188` (nested conditions array) | exact |
| `backend/app/services/agent_loop.py` (MOD: date line, prompt rewrite, accumulator init + 2 ctx kwargs, vocabulary substitution) | service (orchestrator) | event-driven (agent loop) | `_dead_gap_tokens_in_run` `:2097-2104`, `:2156`, `:3034`; connector tool substitution `:1754-1758` | exact |
| `backend/app/services/task_service.py` (MOD: share the D-09 set by reference) | service | request-response | `task_service.py:603-608` (`dead_gap_tokens_in_run=set()`) and `:615` (shared semaphore) | exact |
| `backend/app/api/knowledge_health.py` (MOD, D-24: exclude kind 3 + refused) | controller (read API) | batch (aggregate) | itself `:390-403` (`provider_error` exemption) | exact |
| `backend/app/config.py` (MOD, stale ef_search comment only) | config | — | itself `:1128-1130` | exact |
| `supabase/migrations/200_filtered_retrieval_document_scope.sql` (NEW) | migration | — | `170_documents_source_state.sql:47-120` (bodies) + `073_…:25-33` (DROP-then-CREATE trailing param) + `181_revoke_public_secdef_functions.sql:108-117,126-172` (REVOKE PUBLIC + VERIFY block) | exact (composite) |
| `scripts/full-schema-supplement.sql` (MOD `:636-644` signature literals) | config (bootstrap artifact) | — | itself | exact |
| `supabase/full-schema.sql` (REGENERATED, never hand-edited) | build artifact | — | `bash scripts/regenerate-full-schema.sh` (no `--reset`) | n/a |
| `frontend/src/lib/toolMeta.ts` (MOD: `searchFilterLine`) | utility (pure formatter) | transform | `toolSummary:32-54` in the same file | exact |
| `frontend/src/components/chat/ToolCallPanel.tsx` (MOD: one visible line, both branches) | component | request-response (render) | the sub-agent model line `:247-251` and `:320-324` | exact |
| `backend/tests/unit/test_272_pure_move.py` (NEW) | test | — | `tests/unit/test_214_failure_reason_seam.py:66-80,405-420` (`git show <base>` blob + AST compare) | exact |
| `backend/tests/unit/test_272_tool_schema.py` (NEW) | test | — | `tests/unit/test_115_tool_schema.py:24-59` | exact |
| `backend/tests/unit/test_272_*` handler suites (empty-set short-circuit, lock, audit keys, both arms, validation) (NEW) | test | — | `tests/unit/test_268_search_audit_keys.py:25-69` (SimpleNamespace ctx + spawn capture) + `test_267_cr02_empty_biased_scope_searches.py` (empty-scope inversion) | exact |
| `backend/tests/integration/test_272_rpc_document_scope.py` / `test_272_scope_rls.py` (NEW) | test (integration, live PG) | — | `tests/integration/test_266_two_org_fence.py:128-226` (`fence`, `open_user_conn`, `assert_auth_uid`) | exact |
| Retargeted suites (8 + 3, see Shared Patterns § "Monkeypatch retarget") | test | — | — | n/a (mechanical) |
| `frontend/src/lib/__tests__/toolMeta.test.ts` (MOD) | test | — | itself `:19-40` (pure-lib vitest) | exact |
| `frontend/src/__tests__/components/ToolCallPanel.test.tsx` (MOD) | test | — | itself `:27-57` (`mkDoneTool`, `renderWithTooltip`) | exact |
| `scripts/vitest-count-gate.cjs` (MOD: adopt `toolMeta.test.ts` into BOTH knobs) | config (gate) | — | the existing `"ToolCallPanel.test.tsx": 16` (BASELINE, `:3639`) + `"src/__tests__/components/ToolCallPanel.test.tsx"` (TARGETS, `:5511`) | exact |
| `docs/HOT-FILE-LEDGER.md` (rows AT CREATION for 5 new modules + `openai_service.py` scan-list row) | docs (gate input) | — | `retrieval_tuning.py` section `:7846-7875` + scan-list row `:10944`; `stripComments.testutil.ts` "row added AT CREATION" `:11030`, `:13810-13814` | exact |
| In-RPC exact-scan branch (`IF count ≤ T THEN RETURN QUERY … ORDER BY (dist)+0`) | migration (plpgsql) | — | none in repo | **no analog** (use RESEARCH Pattern 3) |

---

## Pattern Assignments

### `backend/app/services/retrieval_service.py` → split into `retrieval_rpc.py` / `retrieval_rank.py` / `retrieval_documents.py` (Plan 01, D-13 pure move)

**Analog:** the file itself (the move is verbatim) + the 241 `retrieval_tuning.py` extraction precedent.

**Current import block** (`retrieval_service.py:1-20`) — each new module takes only the imports its moved functions use:
```python
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langsmith import traceable
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.config import settings
from app.dependencies import get_user_pg_connection
from app.services.openai_service import embed_texts
from app.services.rerank_service import rerank
from app.services.retrieval_tuning import apply_hnsw_session_knobs
from app.utils.db import aexec

if TYPE_CHECKING:
    from app.models.user_settings import UserEffectiveSettings

logger = logging.getLogger(__name__)
```
Split map: `retrieval_rpc.py` needs `run_in_threadpool`, `settings`, `get_user_pg_connection`, `embed_texts`, `apply_hnsw_session_knobs`; `retrieval_rank.py` needs nothing; `retrieval_documents.py` needs `Client`, `aexec`; `retrieval_service.py` keeps `traceable`, `run_in_threadpool`, `rerank`, `settings`.

**Function boundaries to move verbatim:**
- `_vector_literal` `:27-35`, `_call_as_user` `:38-78`, `_vector_search` `:81-130`, `_keyword_search` `:133-154` → `retrieval_rpc.py`
- `_rrf_fuse` `:157-185`, `_deduplicate_chunks` `:245-269`, `_avg_cosine` `:272-275` → `retrieval_rank.py`
- `_enrich_with_filenames` `:188-242`, `resolve_document_id` `:282-306`, `fetch_full_document` `:309-380` → `retrieval_documents.py`
- `search_documents` `:383-456` (with `@traceable(name="search-documents", run_type="retriever")`) **stays** in `retrieval_service.py`.

**Back-compat re-exports** (keep these names importable from `retrieval_service`, measured importers):
`tool_dispatcher.py:47` (`search_documents, resolve_document_id, fetch_full_document`), `agent_loop.py:79` (`_call_as_user, _vector_literal`), `checked_query_service.py:22` (`search_documents`), `multimodal_service.py:1011` lazy (`resolve_document_id`), `scripts/spike-097/derive_fields.py:61`, `tests/unit/test_retrieval_service.py:13` (`search_documents, _enrich_with_filenames`).

**The in-file G-5 sentence to re-drive deliberately** (`retrieval_service.py:62-70`, inside `_call_as_user`'s docstring — moves with it):
```python
    ⛔ **G-5 — READ THIS BEFORE ADDING ANYTHING ELSE HERE.** This file's extraction has been
    **OWED since Phase 231** and this landing does NOT discharge it. ...
```
`tests/unit/test_241_hnsw_knobs.py:724-728` asserts `"owed" in src and "g-5" in src` over `inspect.getsource(rs)`; `:686` (`test_the_landing_on_the_hot_file_is_a_call_and_its_arguments`) and `:713-717` (`rs._keyword_search` carries no HNSW arg) read `rs`. Retarget the cap/keyword fences to `retrieval_rpc` and rewrite the G-5 sentence + its test in the same commit, with the reason in the test body.

**The 246 fence that goes red the moment this file changes** (`tests/unit/test_246_hnsw_server_probe.py:187-207`):
```python
def test_retrieval_service_is_byte_unchanged():
    """D-246-01 Strict Fence: retrieval_service.py must remain 100% byte-untouched in Phase 246.
    ...
    res = subprocess.run(
        ["git", "diff", "--name-only", "origin/develop", "--", str(target_file)], ...
```
Retire it deliberately (write the reason into the test body: Phase-246-only fence, discharged by 272-01), or the backend baseline reads 72 failed.

**Module-docstring precedent for a module created to keep a hot file's delta small** (`retrieval_tuning.py:1-7`):
```python
"""Phase 241 (QUEUE-06 / D-10 / D-11) — apply the operator's HNSW scan knobs to one request.

⭐ **THIS MODULE EXISTS SO THAT THE LANDING ON `retrieval_service.py` STAYS A CALL.** That file
FIRES G-5 (18 / 10 / 423) and its extraction has been **OWED since Phase 231** ...
```
Each new module opens with a docstring naming the phase, the decision (D-13), and what it is NOT.

---

### `backend/app/services/retrieval_rpc.py` (Plan 01 move; Plan 02 adds `p_document_ids` / `p_exact_max_chunks`)

**Analog:** `retrieval_service._vector_search:81-130` / `_keyword_search:133-154`.

**The asyncpg user-context RPC call (the shape to extend, `:112-130`):**
```python
    return await _call_as_user(
        user_id,
        """SELECT id::text AS id, document_id::text AS document_id, content, chunk_index, similarity
           FROM public.match_document_chunks($1::public.vector, $2, $3, $4, $5, $6, $7)""",
        _vector_literal(query_embedding),
        user_id,
        top_n,
        match_threshold,
        metadata_filter if metadata_filter else None,
        folder_ids if folder_ids else None,
        current_model,
        hnsw_ef_search=(user_settings.hnsw_ef_search if user_settings else settings.hnsw_ef_search),
        hnsw_iterative_scan=(
            user_settings.hnsw_iterative_scan if user_settings else settings.hnsw_iterative_scan
        ),
    )
```
⛔ Plan 02 adds `$8` (`p_document_ids`) and `$9` (`p_exact_max_chunks`) as **trailing** positionals. **Never** apply the `x if x else None` idiom to the document-id list (Pitfall 1 / D-18): pass `None` only when there is no filter; an empty tuple must never reach this call (the handler short-circuits first). The keyword arm (`:145-154`) gets the same `$6` `p_document_ids` (D-19: both arms, same restriction). The filtered-only `iterative_scan` value rides the existing `hnsw_iterative_scan=` kwarg of `_call_as_user` — no new GUC code (`apply_hnsw_session_knobs`, `retrieval_tuning.py:188-282`).

**`_call_as_user` body (`:72-78`) — the RLS context both the RPC and the resolver step 2 use:**
```python
    async with get_user_pg_connection(None, {"id": user_id}) as conn:
        if hnsw_ef_search is not None or hnsw_iterative_scan is not None:
            await apply_hnsw_session_knobs(
                conn, ef_search=hnsw_ef_search, iterative_scan=hnsw_iterative_scan
            )
        rows = await conn.fetch(fn_sql, *args)
    return [dict(r) for r in rows]
```

---

### `backend/app/services/retrieval_scope.py` (NEW — Plan 01 data stub, Plan 02 resolver)

**Analogs:** `document_search_service._candidates:427-471` (compiler-verbatim candidate read), `document_search_service._fetch_all:229-251` (exact-total walk), `folder_utils._resolve_caller_org_ids:130-153` (fail-closed org set), `retrieval_service._call_as_user:72-78` (RLS step 2).

**Imports — function-local for the cycle-prone ones** (precedent `tool_dispatcher._ensure_resolver:222-242`):
```python
def _ensure_resolver() -> None:
    """Bind the document_view_resolver symbols into THIS module's globals on first use.

    Deferred (not a top-level import) to break the cycle:
    tool_dispatcher → document_view_resolver → harness.scope → harness/__init__ →
    phase_types → task_service → tool_dispatcher. ...
    """
    g = globals()
    if g.get("resolve_filter") is None or ...:
        from app.services.document_view_resolver import (
            ResolveError as _RE,
            _build_field_meta as _bfm,
            resolve_filter as _rf,
        )
```
`retrieval_scope` must import `document_view_resolver` / `document_search_service` **inside** the function (or via an `_ensure_*` sentinel binder). ⚠ `tests/unit/test_271_no_embedding.py` forbids `document_search_service` importing retrieval — keep the direction retrieval → find.

**Step 1: candidate read with the compiler verbatim** (copy the builder shape from `document_search_service._candidates:440-454`):
```python
    def structure(q):
        q = apply_fragments(q, fragments)  # the SHARED walk (no fork, D-115-6)
        q = _apply_name(q, req)
        q = _apply_folder(q, folder_ids)
        q = _apply_added_by(q, req, caller)
        q = _apply_dates(q, req)
        q = _apply_version(q, version)
        q = _apply_ids(q, id_allow)
        return q

    def own(count: bool):
        base = supabase.table("documents").select(CANDIDATE_COLUMNS, count="exact" if count else None)
        return structure(base.eq("user_id", caller))

    rows = await _fetch_all(own)
```
⛔ Do **not** copy the own/global two-leg split (`:450-463`) as the visibility rule — D-21: bound step 1 by `org_id IN caller_orgs` (`_resolve_caller_org_ids`), then let RLS decide in step 2. Find's legs drop connection-visible documents.

**Validate + compile (the ONE compiler, `document_view_resolver.validate_and_compile:170-213`):**
```python
    whitelist, number_fields = await _build_field_meta(caller, supabase)
    try:
        view_filter_compiler.validate_fields(flt, whitelist)
        view_filter_compiler.validate_operands(flt, number_fields)
    except ValueError as e:
        raise ResolveError(detail=str(e))
    fragments = view_filter_compiler.compile_filter(flt)
```
Call it with a `ViewFilter(op="and", conditions=[...])` (`models/document_view.py:34-69`). `ResolveError` → result kind 3.

**Date conditions (`document_search_service._apply_dates:189-211` + `_DATE_COLUMN:97-101`):**
```python
_DATE_COLUMN = {
    "added": "created_at",
    "source_created": "source_created_at",
    "source_modified": "source_modified_at",
}
...
    for d in req.dates:
        col = _DATE_COLUMN[d.which]
        if d.op == "before":
            q = q.lt(col, d.value)
        elif d.op == "after":
            q = q.gte(col, _day_after(d.value))
        elif d.op == "between":
            q = q.gte(col, d.value).lt(col, _day_after(d.value2))
```
The default "document date" is the compiler field `date` → `date_typed` (D-05), NOT a `FindDate`. Route `added`/`source_created`/`source_modified` to `FindDate` (`models/document_search.py:108-136`) first (Pitfall 14).

**Exact-total walk (`document_search_service._fetch_all:229-251`):**
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
        log.warning("document search read TRUNCATED: %s of %s rows", len(rows), total)
        raise SearchTruncatedError()
```

**Fail-closed caller orgs (`folder_utils._resolve_caller_org_ids:130-153`):**
```python
async def _resolve_caller_org_ids(supabase: "Client", user_id: str) -> set[str]:
    ...
    resp = await aexec(
        supabase.table("org_members").select("org_id").eq("user_id", user_id)
    )
    rows = resp.data if isinstance(resp.data, list) else ([resp.data] if resp.data else [])
    return {str(r["org_id"]) for r in rows if isinstance(r, dict) and r.get("org_id") is not None}
```
Empty set → `ScopeResult` empty (kind 2), never "no restriction".

**Step 2: RLS intersect** — reuse `get_user_pg_connection(None, {"id": user_id})` exactly as `_call_as_user:72` does (`dependencies.py:158-177`: opens a transaction, `SET LOCAL ROLE authenticated` + both claim GUCs, COMMIT reverts). Statement shape: `SELECT id::text FROM public.documents WHERE id = ANY($1::uuid[])` with the id list as a bind param.

**Empty-vs-None distinction precedent** (`document_search_service.search_documents:519-552`):
```python
    folder_ids = await _resolve_folder(req, caller, supabase)
    if isinstance(folder_ids, list) and not folder_ids:
        return _zero_result(req)
    ...
    if id_allow is not None and not id_allow:
        # An empty allow-list: never send `.in_("id", [])`; answer with the zero shape.
        return _zero_result(req, older_matches=older_matches)
```
`ScopeResult` must carry the same distinction as a type or an explicit flag (D-18).

**`DEFAULT_PREDICATES` as data** — no repo analog for a predicate registry; follow the frozen-dataclass sketch in RESEARCH Pattern 2. Closest "closed data set" shape in-repo: `document_view_resolver._SOURCE_FACT_FIELDS:127-141` (a `frozenset` with a comment per entry).

---

### `backend/app/services/search_documents_tool.py` (NEW — Plan 01 verbatim move, Plan 03 behaviour)

**Analog:** `tool_dispatcher._handle_search_documents:780-975` (moved verbatim in Plan 01) + `_handle_query_documents_by_view:986-1151` (calm `ResolveError` → `ToolResult`, catalog of filterable fields, `getattr`-guarded spawn).

**Imports it needs (from `tool_dispatcher.py:47,50` and the `ToolResult`/`ToolContext` dataclasses `:104-208`):**
```python
from app.services.retrieval_service import search_documents
from app.services.audit_service import write_audit_entry
```
`ToolResult` / `ToolContext` live in `tool_dispatcher`; importing them from the new module at module level creates a cycle (`tool_dispatcher` imports the handler). Use `TYPE_CHECKING` for `ToolContext`, and either lazy-import `ToolResult` inside the handler or move nothing and have `tool_dispatcher` import the handler **after** the dataclasses are defined. ⚠ Patch-where-used: after the move, the handler resolves `search_documents` / `write_audit_entry` from **this** module's globals — every test patching `td.search_documents` must be retargeted (see Shared Patterns).

**Provider-error arm (kind 4, existing, keep byte-identical) — `tool_dispatcher.py:789-875`:**
```python
    except Exception as exc:  # noqa: BLE001 — honest tool-result error, never raise into the loop
        logger.error("search_documents failed for run %s: %s", getattr(ctx, "run_id", None), exc)
        from app.services.openai_service import resolve_effective_embedding_provider
        provider = resolve_effective_embedding_provider(getattr(ctx, "user_settings", None))
        try:
            ctx.spawn(write_audit_entry(
                user_id=ctx.current_user["id"],
                action_type="search.query",
                metadata={
                    "query_text": args["query"],
                    "document_ids": [],
                    "retrieval_status": "provider_error",
                    "run_id": str(ctx.run_id),
                    "thread_id": str(ctx.thread_id),
                    "parent_run_id": str(ctx.parent_run_id) if ctx.parent_run_id else None,
                    "folder_ids": [str(f) for f in (ctx.folder_subtree_ids or [])],
                },
                supabase=ctx.supabase,
            ))
        except Exception:  # noqa: BLE001 - diagnostics may never mask the outage
            logger.warning(...)
        return ToolResult(
            result=json.dumps({"error": "retrieval_unavailable", "provider": provider, "detail": (...)}),
            citations=[], source_refs=[],
            retrieval_error={"provider": provider, "detail": str(exc), "retrieval_status": "provider_error"},
        )
```

**Folder-scope post-query clip (keep, `:882-896`):**
```python
    if ctx.folder_subtree_ids is not None:
        _scope = set(map(str, ctx.folder_subtree_ids))   # Pitfall 1: set()-ify LOCALLY
        _kept = [h for h in (results or []) if str(h.get("folder_id")) in _scope]
        _dropped = [h for h in (results or []) if str(h.get("folder_id")) not in _scope]
        if _dropped:
            results = _kept
            try:
                await ctx.emit(ctx.redis, ctx.run_id, "scope_violation", ...)
            except Exception:
                logger.exception("scope_violation emit failed for run %s", getattr(ctx, "run_id", None))
    tool_result = json.dumps(results) if results else "No relevant documents found."
```
⛔ Unfiltered calls keep the literal `"No relevant documents found."` (asserted by `test_260` / `test_267_cr02`).

**Citation build (keep, `:899-925`)** and **success audit (`:934-968`)**:
```python
    ctx.spawn(write_audit_entry(
        user_id=ctx.current_user["id"],
        action_type="search.query",
        metadata={
            "query_text": args["query"],
            "document_ids": _audit_doc_ids,
            "similarities": _sims,
            "run_id": str(ctx.run_id),
            "thread_id": str(ctx.thread_id),
            "parent_run_id": str(ctx.parent_run_id) if ctx.parent_run_id else None,
            "folder_ids": [str(f) for f in (ctx.folder_subtree_ids or [])],
        },
        supabase=ctx.supabase,
    ))
```
Plan 03 centralises this into ONE writer used by every kind and adds `filters`, `result_kind`, `matched_document_count`, `undated_excluded` (additive; readers `.get()`). ⚠ `tests/unit/test_268_search_audit_keys.py:106-112` asserts `src.count('"run_id": str(ctx.run_id)') == 2` over `inspect.getsource(td._handle_search_documents)` — re-drive it to "one writer, every arm".

**Calm invalid-filter result (kind 3) — copy from `_handle_query_documents_by_view:1077-1107`:**
```python
        try:
            flt = ViewFilter.model_validate(inline)
        except (ValidationError, ValueError) as e:
            return ToolResult(result=json.dumps({
                "status": "invalid_filter",
                "message": f"the filter shape is invalid: {e}",
                "hint": "call with no arguments to see filterable fields",
            }))
    ...
    except ResolveError as e:  # the extracted core raises this, NOT HTTPException
        return ToolResult(result=json.dumps({
            "status": "invalid_filter",
            "message": e.detail,
            "hint": "call with no arguments to see filterable fields",
        }))
```
⚠ For kind 3 the research shape uses an `"error"` key (`{"error":"invalid_filter","allowed":[…]}`); `ToolCallDetails.tsx:66-70` renders only `parsed.error` for such a result. For kind 2 avoid `"error"` (use `"status"`), or the card shows a destructive line instead of the explanation.

**Whitelist advertised from the SAME source the compiler validates (`:1036-1050`):**
```python
            views = await document_view_service.list_views(caller, supabase=ctx.supabase)
            whitelist, _ = await _build_field_meta(caller, ctx.supabase)
        ...
        return ToolResult(result=json.dumps({
            "mode": "catalog",
            "views": [{"name": v["name"]} for v in views],
            "filterable_fields": sorted(whitelist),
            ...
```
D-04's "allowed values" list comes from `_build_field_meta` + the enabled defs' `options` (`metadata_field_service.list_field_definitions:34-52`), never a second list.

**`getattr`-guarded spawn for duck-typed ctx (`:1121-1133`):**
```python
    _spawn = getattr(ctx, "spawn", None)
    if callable(_spawn):
        try:
            _spawn(write_audit_entry(...))
        except Exception:  # noqa: BLE001 — audit is best-effort; never block the answer
            logger.exception(...)
```

**`llm_content` vs `result` split (`ToolResult:199-208`):** `result` stays the JSON **array** the UI's `SearchDocumentsBody` requires (`ToolCallDetails.tsx:86` checks `Array.isArray(parsed)`); the filter summary object for the model goes in `llm_content`. Precedent for the same split: `_handle_execute_code` returns `ToolResult(result=_short_circuit, llm_content=_short_circuit)` (`tool_dispatcher.py:2255-2256`).

**D-09 lock consumer shape — copy from the dead-gap pre-flight (`tool_dispatcher.py:2237-2256`):**
```python
    if ctx.dead_gap_tokens_in_run is not None:
        _dead_token = next(
            (t for t in ctx.dead_gap_tokens_in_run
             if t and _code_references_dead_token(code, t)),
            None,
        )
        if _dead_token is not None:
            ...
            _short_circuit = _repeat_blocked_result(_dead_token)
            return ToolResult(result=_short_circuit, llm_content=_short_circuit)
```
and the producer side (`:2766-2767`): `if ctx.dead_gap_tokens_in_run is not None: ctx.dead_gap_tokens_in_run.add(_gap["token"])`. Use `getattr(ctx, "empty_filter_fields_in_run", None)` in the new handler because the unit tests drive it with `SimpleNamespace` ctx objects (`test_268:25-38`).

---

### `backend/app/services/tool_dispatcher.py` (MOD — narrow cut, D-15)

**Analog:** itself.

**ToolContext additive default-off field — copy the `dead_gap_tokens_in_run` declaration and its comment discipline (`:121-133`):**
```python
    # Phase 142 (SRH-01 / D-06) — run-scoped repeat-guard. ...
    # By-reference run-scoped accumulator (mirrors new_file_hashes_in_run): init
    # once in agent_loop.py, threaded into BOTH ToolContext builds, FRESH set() for
    # sub-agents (task_service — a sub-agent's dead call must not block the parent).
    # None on EVERY unwired (harness/eval/test/duck-typed) caller => the reshape
    # `.add` and the pre-flight membership check are literal no-ops (D-14
    # byte-identical Deep). ...
    dead_gap_tokens_in_run: set | None = None
```
New field: `empty_filter_fields_in_run: set | None = None`, with a comment that states it is **shared** with sub-agents (the deliberate divergence from `dead_gap_tokens_in_run`, recorded as a decision — RESEARCH A5).

**Registry: keep the one line (`:4721-4727`):**
```python
_TOOL_REGISTRY: dict[str, Callable] = {
    ...
    "search_documents": _handle_search_documents,
```
After the move: `from app.services.search_documents_tool import handle_search_documents as _handle_search_documents` (re-export keeps `td._handle_search_documents` importable for `test_098_scope_governance.py`, `test_2171_search_error_audit.py` `inspect.getsource`, `test_tool_dispatcher.py`). Comment shape for the line: `# Phase 272 (D-15) — handler moved to search_documents_tool.py; registry/handler split still OWED (→273)`, matching the `# Phase 151 (FILE-01) — registry + get_tools BOTH …` comments at `:4748-4757`. Tool count stays 29 (`test_259_closed_core_inventory.py:40,113`, `test_261_closed_core_inventory.py:41`).

---

### `backend/app/services/openai_service.py` (MOD — schema + vocabulary)

**Analog:** `QUERY_DOCUMENTS_BY_VIEW_TOOL:106-188` (same `{field, op, value, value2, values, unit}` items, same op enum).

**The conditions-items shape to copy (`:141-175`):**
```python
                        "conditions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "field": {"type": "string", "description": "..."},
                                    "op": {
                                        "type": "string",
                                        "enum": [
                                            "eq", "gte", "lte", "one_of", "contains",
                                            "is_empty", "within_next", "older_than",
                                            "before", "after", "between",
                                        ],
                                    },
                                    "value": {"type": ["string", "number", "boolean", "null"]},
                                    "value2": {"type": ["string", "number", "null"], ...},
                                    "values": {"type": "array", "items": {"type": "string"}, ...},
                                    "unit": {"type": "string", "enum": ["days", "weeks", "months"], ...},
                                },
                                "required": ["field", "op"],
```
⚠ **Deviate on `value`/`value2`:** use a single `"type": "string"` (RESEARCH Pattern 4) — the multi-type arrays above depend on Google's `_translate_nullable_type` collapse (a rejected Tool takes down every Gemini Deep run). No `anyOf`/`oneOf`/`additionalProperties` in the new part (`google_service._GOOGLE_UNSUPPORTED_SCHEMA_KEYS:249-252` strips `additionalProperties`). Keep `metadata_filter` (`:37-47`) in the schema — `test_module7_tools.py:51-54` pins it optional.

**The text to remove (D-02), `SEARCH_DOCUMENTS_TOOL.description` `:20-29`:**
```python
            "IMPORTANT: call this WITHOUT metadata_filter first. Only add "
            "metadata_filter when the user explicitly names a document attribute "
            ...
            "Supported filter keys (when needed): document_type, language, author, date."
```

**Per-request description builder — analog `template_render_service.build_field_map_tool_schema:115-135`:**
```python
def build_field_map_tool_schema(placeholder_keys: list[str]) -> dict:
    schema = GenericFieldMap.model_json_schema()
    keys = ", ".join(sorted(placeholder_keys))
    base_desc = schema.get("description", "")
    schema["description"] = (
        f"{base_desc} The template requires these top-level placeholder keys: {keys}. "
        ...
    ).strip()
    return schema
```
New `with_search_vocabulary(...)` (name is discretion) returns a **copy** of `SEARCH_DOCUMENTS_TOOL` (never mutate the module constant — `get_tools()` returns the shared dict) with the description enriched from enabled defs (key, type, enum options capped) + top-15 `document_type` values (D-23). `get_tools()` (`:1116-1170`) stays pure and synchronous.

**Parity test analog:** `tests/unit/test_115_tool_schema.py:41-59` (`set(op_enum) == set(typing.get_args(ViewCondition.model_fields["op"].annotation))`) and `:24-29` (`"anyOf" not in json.dumps(schema)`).

---

### `backend/app/services/agent_loop.py` (MOD — honoured by construction, D-16)

**Analog:** itself.

**Accumulator init — copy `:2097-2104` exactly:**
```python
        # Phase 142 (SRH-01 / D-06) — run-scoped repeat-guard set. Init ONCE per
        # run (OUTSIDE the iteration loop), threaded by-reference into BOTH
        # ToolContext builds below exactly like _new_file_hashes_in_run so a
        # PERMANENT runtime gap that fired on iteration N short-circuits the same
        # dead call on iteration N+1 (Pitfall 1 — a fresh ctx is built every
        # iteration; setattr would not survive). ...
        _dead_gap_tokens_in_run: set[str] = set()
```
**Thread into BOTH builds** — resume ctx `:2141-2156` and per-iteration ctx `:3019-3034`:
```python
                dead_gap_tokens_in_run=_dead_gap_tokens_in_run,  # 142 — run-scoped repeat-guard (by-reference)
```
Add the sibling kwarg on the next line of each build. ⚠ `has_connection_retrieval` (`tool_dispatcher.py:930`, set on `ctx`) is **not** the precedent: `ToolContext` is rebuilt every iteration (`:3017-3018`).

**Mode switch where the date line goes (`:1468-1476`):**
```python
    if body.agent_mode == "explorer":
        active_system_prompt = EXPLORER_SYSTEM_PROMPT
        active_tools = get_explorer_tools()
        max_iterations = 8   # GEN-04: was 6
    else:
        active_system_prompt = SYSTEM_PROMPT
        active_tools = None  # None = use default get_tools() in create_streaming_chat
        max_iterations = 15  # GEN-04: was 8
```
Note-append precedent right below (`:1478-1488`): `active_system_prompt = active_system_prompt + folder_scope_note`. The D-07 line is the same append shape (`f"\n\nToday's date is {...isoformat()} (UTC)."`).

**Tool-list substitution precedent for the vocabulary (`:1754-1758`):**
```python
            if active_conns:
                connector_tools = build_chat_tools_for_connectors(active_conns)
                if connector_tools:
                    base_tools = list(active_tools) if active_tools is not None else list(get_tools(user_settings))
                    active_tools = base_tools + connector_tools
```
Substitute the enriched `search_documents` entry the same way, **only** when the caller has ≥1 enabled custom field (so the no-custom-field path stays `active_tools=None`, byte-identical). Place it before the connector block or make the connector block read the substituted list.

**Prompt lines to rewrite (D-02 / D-22):** `SYSTEM_PROMPT` `:703` (`"Only add \`metadata_filter\` when the user explicitly asks …"`), `:739-741` (`"**Hybrid fallback — do not stop on zero results:** …"`), `:750-752` (`"**Zero results from search_documents:** … try grep … or query_documents …"`). Add the filtered-empty override ("a filtered search that matched no documents is a final answer").

---

### `backend/app/services/task_service.py` (MOD — one kwarg)

**Analog:** `sub_ctx = ToolContext(...)` `:585-663`.

**The fresh-set shape NOT to copy (`:603-608`):**
```python
        # Phase 142 (SRH-01 / D-06 / Pitfall 6 / T-142-05) — a FRESH set(), NOT the
        # parent's run-scoped set. ...
        dead_gap_tokens_in_run=set(),
```
**The shared-by-reference shape TO copy (`:612-615`):**
```python
        # D-085-15 — share the parent's semaphore. Sub-agents can't spawn
        # task() (nesting cap above) but sharing the semaphore is the
        # belt-and-suspenders guarantee.
        per_run_task_semaphore=parent_ctx.per_run_task_semaphore,
```
→ `empty_filter_fields_in_run=parent_ctx.empty_filter_fields_in_run,` with a comment stating why it diverges from `dead_gap_tokens_in_run` (a sub-agent must not become an unfiltered bypass). The `born_for_bundle_id=parent_ctx.born_for_bundle_id` comment at `:656-662` shows how to word a deliberate divergence.

---

### `backend/app/api/knowledge_health.py` (MOD — D-24, one reader line)

**Analog:** itself `:388-403`:
```python
        meta = row.get("metadata") or {}
        doc_ids = meta.get("document_ids") or []
        is_error = meta.get("retrieval_status") == "provider_error"
        if is_error:
            daily[date_str]["could_not_search"] += 1
        else:
            daily[date_str]["retrieval_count"] += 1
            if doc_ids:
                daily[date_str]["found_something"] += 1
            else:
                daily[date_str]["found_nothing"] += 1
```
Exclude `result_kind in ("invalid_filter", "refused_retry")` from `found_nothing` by the same `.get()` read; kind 2 (`no_documents_matched`) still counts. Honoured by construction on a G-5 file — one condition, no new series.

---

### `supabase/migrations/200_filtered_retrieval_document_scope.sql` (NEW)

**Analogs:** `170_documents_source_state.sql` (header + both current bodies), `073_embedding_provider_and_chunk_tags.sql:25-33` (trailing-param DROP-then-CREATE), `181_revoke_public_secdef_functions.sql` (REVOKE PUBLIC + VERIFY block).

**Header discipline (`170:1-20`):**
```sql
-- 170_documents_source_state.sql
-- Phase 234: ...
--
-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor.
-- NEVER `supabase db push` / `db reset`.
-- ============================================================================

BEGIN;
```

**DROP the old overload first — the 073 rationale (`073:25-33`):**
```sql
--    A trailing param creates a NEW overload (CREATE OR REPLACE matches an exact signature only),
--    so DROP the prior 6-arg overload first — exactly the migration-016 precedent — leaving ONE
--    clean function (no "function is not unique" ambiguity, no duplicate in full-schema.sql).
DROP FUNCTION IF EXISTS public.match_document_chunks(
  public.vector, uuid, integer, double precision, jsonb, uuid[]
);
```
Old signatures to drop now: `match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text)` and `keyword_search_chunks(text, uuid, integer, jsonb, uuid[])`.

**Bodies to copy verbatim, then add the predicate (`170:48-120`):**
```sql
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_user_id uuid,
  match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.3,
  metadata_filter jsonb DEFAULT NULL::jsonb,
  p_folder_ids uuid[] DEFAULT NULL::uuid[],
  p_embedding_model text DEFAULT NULL::text
)
 RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.document_id, dc.content, dc.chunk_index,
         1 - (dc.embedding OPERATOR(public.<=>) query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())
    AND (
      dc.user_id = auth.uid()
      OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
      OR public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)
    )
    AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')
    AND 1 - (dc.embedding OPERATOR(public.<=>) query_embedding) > match_threshold
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))
    AND (p_embedding_model IS NULL OR dc.embedding_model = p_embedding_model)
  ORDER BY dc.embedding OPERATOR(public.<=>) query_embedding
  LIMIT match_count;
END;
$function$;
```
New trailing params `p_document_ids uuid[] DEFAULT NULL`, `p_exact_max_chunks integer DEFAULT NULL`; add `AND (p_document_ids IS NULL OR dc.document_id = ANY (p_document_ids))` to both bodies; `cardinality(p_document_ids) = 0 → RETURN` (empty set = zero rows, never "all"). The exact branch has **no in-repo analog** — use RESEARCH Pattern 3 (`ORDER BY (dist) + 0`). Plus `CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks (document_id);` (or CONCURRENTLY as a separate statement outside the transaction, Pitfall 8).

**REVOKE/GRANT with the NEW signatures (`181:108-117`):**
```sql
REVOKE EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text) FROM PUBLIC;
...
```
**VERIFY block to append (`181:126-172`)** — the `with checks(what, ok) as (values ('anon cannot exec …', not has_function_privilege('anon', '<signature>', 'EXECUTE')), …) select case when ok then 'PASS' else '*** FAIL ***' end …` form, re-typed for the new 9-arg / 6-arg signatures, plus a one-row-per-name `pg_proc` check (Pitfall 6).

**Same-commit artifact edit:** `scripts/full-schema-supplement.sql:636-644` carries the same REVOKE/GRANT lines with the OLD signatures — update them to the new ones in the migration's commit, then `bash scripts/regenerate-full-schema.sh` (no `--reset`).

---

### `frontend/src/lib/toolMeta.ts` (MOD — `searchFilterLine`)

**Analog:** `toolSummary` in the same file (`:32-54`), the documented "one place so they don't drift" home (`:4-7`):
```ts
/**
 * Shared tool metadata helpers — used by ToolCallPanel and MessageItem.
 * Keeps labels and summaries in one place so they don't drift.
 */
...
export function toolSummary(name: string, args: Record<string, unknown>): string | null {
  if (name === "execute_code" && args.description) return args.description as string
  ...
  if (args.query) return args.query as string
  if (args.filename) return args.filename as string
  return null
}
```
Add `export function searchFilterLine(name: string, args: Record<string, unknown>): string | null` beside it: pure, reads `args.filters` (array) and `args.metadata_filter` (object → `eq`), returns `null` when unfiltered (the code sketch in RESEARCH §Code Examples). Derive from **args**, never from `tc.result` (result truncated at 2000 chars on persist; args persist whole).

---

### `frontend/src/components/chat/ToolCallPanel.tsx` (MOD — one visible line)

**Analog:** the sub-agent model line, rendered in BOTH the collapsed-essence branch and the full branch.

Collapsed-essence branch (`:244-252`):
```tsx
              {isCollapsedToEssence ? (
                <>
                  <ToolEssenceLine tc={tc} onExpand={() => expandStep(stepKey)} />
                  {tc.sub_agent_model && (
                    <div className="ml-8 mt-1 text-[10px] text-muted-foreground italic font-mono">
                      Sub-agent: {tc.sub_agent_model}
                    </div>
                  )}
                </>
```
Full branch (`:319-324`):
```tsx
                  {/* Sub-agent model line */}
                  {tc.sub_agent_model && (
                    <div className="ml-8 mt-1 text-[10px] text-muted-foreground italic font-mono">
                      Sub-agent: {tc.sub_agent_model}
                    </div>
                  )}
```
Import alongside the existing `import { toolLabel } from "@/lib/toolMeta"` (`:19`). Compute once per row next to `const summary = toolSummary(tc)` (`:169`). Give the element a `data-testid` (e.g. `search-filter-line`) so the test can assert rendered **text content**, not presence (CLAUDE.md G-8 note: presence assertions cannot see content drift). ⛔ Never a `title=` tooltip (OV-266-01). Load `Skill("sketch-findings-agentic-rag")` before editing.

---

### `backend/tests/unit/test_272_pure_move.py` (NEW)

**Analog:** `tests/unit/test_214_failure_reason_seam.py`.

**Base-blob reader (`:66-80`) — the `encoding="utf-8"` is load-bearing on Windows:**
```python
def _blob_at_base(rel_path: str) -> str:
    """A tracked file's contents at the plan's base commit."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS. ...
    return subprocess.run(
        ["git", "show", f"{PLAN_BASE_SHA}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout
```
**Compare-against-base + non-vacuity (`:405-420`):**
```python
def test_load_run_phases_SQL_is_byte_identical_to_the_base_commit():
    now = _select_literals_of(_module_source("backend/app/db/workflows.py"), "load_run_phases")
    base = _select_literals_of(_blob_at_base("backend/app/db/workflows.py"), "load_run_phases")
    assert now == base
    # Non-vacuity: the extraction really found the statement it claims to be pinning.
    assert len(now) == 1
```
For 272: per moved function, `ast.dump` of the `FunctionDef` found in the base blob of `retrieval_service.py` == `ast.dump` of the one in its new module. Add a non-vacuity assertion that every name in the move list was found in both.

---

### `backend/tests/unit/test_272_*` handler suites (NEW)

**Analog:** `tests/unit/test_268_search_audit_keys.py:25-69` (SimpleNamespace ctx, `spawn=spawned.append`, `AsyncMock` audit, run the spawned coroutines):
```python
def _ctx(*, parent=None, folders=FOLDERS):
    spawned: list = []
    ctx = SimpleNamespace(
        current_user={"id": "user-1"},
        supabase=object(),
        user_settings=None,
        folder_subtree_ids=folders,
        run_id=RUN,
        thread_id=THREAD,
        parent_run_id=parent,
        spawn=spawned.append,
        has_connection_retrieval=False,
    )
    return ctx, spawned


def _run(monkeypatch, *, error=False, hits=None, parent=None, folders=FOLDERS):
    import app.services.tool_dispatcher as td
    write = AsyncMock()
    monkeypatch.setattr(td, "write_audit_entry", write)
    ...
        monkeypatch.setattr(td, "search_documents", _ok)
    ctx, spawned = _ctx(parent=parent, folders=folders)

    async def _runner():
        await td._handle_search_documents({"query": "q", "metadata_filter": None}, ctx)
        for coro in spawned:
            await coro

    asyncio.run(_runner())
```
New suites patch the **new module** (`app.services.search_documents_tool`), add `empty_filter_fields_in_run=set()` to the namespace for the lock suite, and for D-18 assert the patched `search_documents` and the resolver-step RPC spy were called **0** times on an empty set. The empty-scope inversion narrative to cite in the D-18 test docstring: `tests/unit/test_267_cr02_empty_biased_scope_searches.py:1-17`.

---

### `backend/tests/integration/test_272_*.py` (NEW)

**Analog:** `tests/integration/test_266_two_org_fence.py`.

**Imports + marker (`:35-42`):**
```python
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg
from tests.integration.test_163_rls_documents import _add_comember, _drop_user

pytestmark = requires_pg
```
**Fixture shape (`:128-169`):** seed both orgs → `yield` dict → teardown in `finally`.
**Driving the RPC as a user (`:197-226`):**
```python
    vec_sql = (
        "SELECT document_id FROM public.match_document_chunks("
        "$1::text::public.vector, $2::uuid, 50, 0.0, NULL, NULL, NULL)"
    )
    async def _run(uid: str) -> tuple[set, set]:
        async with open_user_conn(pg_pool, uid) as conn:
            await assert_auth_uid(conn, uid)
            kw = {r["document_id"] for r in await conn.fetch(kw_sql, kw_text, uid)}
            vc = {r["document_id"] for r in await conn.fetch(vec_sql, fence["vec"], uid)}
        return kw, vc
    ...
    assert b_doc not in s_vec, "LEAK: vector search returned org B's chunk to an org-A-only user"
    assert a_doc in s_vec, "vector query found nothing in S's own org — the query is broken"
```
⚠ This existing test calls the RPC with **7 positionals** — it keeps working only because 200's new params are trailing with defaults. New cases: pass org-B ids as `p_document_ids` as an org-A user → 0 rows; `'{}'::uuid[]` → 0 rows; positive control in-org.

---

## Shared Patterns

### Calm tool errors (never raise into the agent loop)
**Source:** `tool_dispatcher._handle_search_documents:789-875`, `_handle_query_documents_by_view:1036-1107`
**Apply to:** `search_documents_tool.py` (every result kind), `retrieval_scope.py` callers
Every failure becomes a `ToolResult(result=json.dumps({...}))`; audit writes are wrapped in their own `try` so diagnostics can never mask the answer (`:833-856`).

### Run-scoped by-reference accumulator
**Source:** `ToolContext.dead_gap_tokens_in_run` (`tool_dispatcher.py:121-133`), init `agent_loop.py:2104`, threaded `:2156` and `:3034`, sub-agent `task_service.py:608`
**Apply to:** the D-09 `empty_filter_fields_in_run` set (Plan 03). Default `None` on every unwired caller = literal no-op; sub-agents **share** (divergence recorded).

### RLS user context for every count/id set shown to the model
**Source:** `dependencies.get_user_pg_connection:158-177`; consumer `retrieval_service._call_as_user:72-78`
**Apply to:** `retrieval_scope.resolve_document_scope` step 2, D-06 undated count, D-11 nearby values, D-20 distinct-value lookup. Service-role (`ctx.supabase`) results never leave the resolver un-intersected (D-21).

### One compiler, never a second dialect
**Source:** `document_view_resolver.validate_and_compile:170-213` + `apply_fragments:216-285`; Find reuses them at `document_search_service.py:58-63,441,517`
**Apply to:** `retrieval_scope.py`, `search_documents_tool.py` (`metadata_filter` → `eq` conditions → same compiler). Values ride bound PostgREST params; `.in_` for ids only (`document_search_service._pg_in_list:82-93` for stored strings with quotes).

### Additive `search.query` audit metadata
**Source:** `tool_dispatcher.py:951-968` (+ the 268 join keys comment at `:958-961`)
**Apply to:** the one audit writer in `search_documents_tool.py`. Readers that must stay green: `knowledge_health.py:388-403`, `document_queries.py:76-101`, `api/audit.py:67` (all `.get()` known keys).

### Monkeypatch retarget after a move (patch-where-used)
**Source:** the `_ensure_resolver` comment `tool_dispatcher.py:62-68` ("the unit-test `monkeypatch.setattr(td, "resolve_filter", ...)` still targets the exact name the handler calls")
**Apply to (Plan 01, same commit as the move):**
- `retrieval_service` move: `tests/unit/test_retrieval_service.py` (14× `patch("app.services.retrieval_service.embed_texts")` → `app.services.retrieval_rpc.embed_texts`), `tests/unit/test_241_hnsw_knobs.py` (`rs._call_as_user`, `rs.embed_texts`, `rs.get_user_pg_connection`, positional `rs._vector_search`/`rs._keyword_search`, `inspect.getsource(rs)` cap at `:680`, G-5 sentence `:724-728`), `tests/unit/test_246_hnsw_server_probe.py:187-207` (retire).
- handler move: `tests/test_098_scope_governance.py`, `tests/test_2171_search_error_audit.py`, `tests/unit/test_260_financial_analyzer_conversation.py`, `tests/unit/test_267_cr02_empty_biased_scope_searches.py`, `tests/unit/test_268_search_audit_keys.py` (incl. the `== 2` source count at `:106-112`), `tests/unit/test_retrieval_failure_honesty.py`, `tests/unit/test_tool_dispatcher.py` — patch `app.services.search_documents_tool.search_documents` / `.write_audit_entry`. ⚠ `tests/test_098_*` and `tests/test_2171_*` are top-level (not in the `tests/unit` baseline gate) — run them explicitly. Add one positive control proving the retargeted patch is hit.

### Ledger rows at creation
**Source:** `docs/HOT-FILE-LEDGER.md` scan-list row `:10944` (`retrieval_tuning.py`, `4 / 2 / 364 | no (2 phases) | young (241, 246) …`) and its section `:7846-7875`; `stripComments.testutil.ts` "Row added AT CREATION" `:11030`, section `:13810-13814`
**Apply to:** `retrieval_rpc.py`, `retrieval_rank.py`, `retrieval_documents.py`, `retrieval_scope.py`, `search_documents_tool.py` (rows + sections in the same commit that creates each), plus the missing scan-list row for `openai_service.py` (section exists, row does not). Disposition cell ≤ 200 chars (`scripts/check-claude-md-size.cjs` caps it). ⛔ Do **not** add rows to CLAUDE.md's abridged table (119,524 chars, at the warn band).

### Count-gate adoption (both knobs)
**Source:** `scripts/vitest-count-gate.cjs` BASELINE `"ToolCallPanel.test.tsx": 16` (`:3639`) and TARGETS `"src/__tests__/components/ToolCallPanel.test.tsx"` (`:5511`)
**Apply to:** `src/lib/__tests__/toolMeta.test.ts` (in neither knob today) — add to BOTH, with the count taken from the gate's own printed `— N new` figure; bump the `ToolCallPanel.test.tsx` pin for any added case.

## No Analog Found

| File / Element | Role | Data Flow | Reason |
|---|---|---|---|
| Exact-scan branch inside `match_document_chunks` (migration 200: `IF n_chunks <= p_exact_max_chunks THEN RETURN QUERY … ORDER BY (dist) + 0 ELSE …`) | migration (plpgsql) | — | No existing RPC branches between an exact and an index scan; use RESEARCH Pattern 3 and the pgvector README citation. Measure with body-SQL EXPLAIN (custom + generic plan), never `recall_eval.inspect_execution_plan`'s stats-counter fallback (Pitfall 9). |
| D-11 nearby-values query (group matched docs by month / enum option, RLS-scoped) | service query | batch (aggregate) | No existing month-bucketing document count. Build it on the step-2 RLS connection with bind params only; closest shape is `document_view_resolver.resolve_filter` count-only (`:347-371`, id-set union, never `count + count`). |

## Metadata

**Analog search scope:** `backend/app/services/` (retrieval_*, tool_dispatcher, document_view_resolver, document_search_service, openai_service, agent_loop, task_service, template_render_service, connectors/chat_tools, metadata_field_service, google_service), `backend/app/models/` (document_view, document_search), `backend/app/api/knowledge_health.py`, `backend/app/dependencies.py`, `backend/app/utils/folder_utils.py`, `supabase/migrations/` (036, 073, 170, 181), `scripts/full-schema-supplement.sql`, `backend/tests/{unit,integration}/`, `frontend/src/lib/toolMeta.ts`, `frontend/src/components/chat/{ToolCallPanel,StepRow,ToolCallDetails}.tsx`, `frontend/src/{lib/__tests__,__tests__/components}/`, `scripts/vitest-count-gate.cjs`, `docs/HOT-FILE-LEDGER.md`
**Files scanned:** ~35
**Pattern extraction date:** 2026-10-03
