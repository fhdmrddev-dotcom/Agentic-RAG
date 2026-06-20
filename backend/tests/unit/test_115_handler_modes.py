"""Phase 115 Wave-0 — SC#1 handler mode-routing RED scaffold (Plan 02 target).

`_handle_query_documents_by_view(args, ctx)` routes three modes off a single flat,
polymorphic arg set (`view` XOR `filter`+`limit`):

  * empty args                       → CATALOG (a dict of saved views + filterable fields)
  * an inline `filter` with a BAD field → a CALM `ToolResult` JSON string (NOT a raised
    exception — the agent loop must keep going; a ResolveError is mapped to a string)
  * a well-formed inline `filter`     → routes to resolve

Imports are inside the test bodies so collection never errors on the not-yet-built
handler while RED.
"""

import json

import pytest


@pytest.mark.asyncio
async def test_empty_args_returns_catalog(make_tool_context):
    """Empty args → a catalog dict (saved views + filterable fields), never a resolve."""
    from app.services.tool_dispatcher import ToolResult, _handle_query_documents_by_view

    ctx = make_tool_context()
    result = await _handle_query_documents_by_view({}, ctx)
    assert isinstance(result, ToolResult)
    payload = json.loads(result.result)
    # Catalog shape — exact keys are Plan-02-owned; assert the catalog contract surface.
    assert "filterable_fields" in payload or "views" in payload or "saved_views" in payload, (
        f"empty args must return a catalog, got {payload}"
    )


@pytest.mark.asyncio
async def test_bad_inline_filter_returns_calm_string_not_raise(make_tool_context):
    """An inline `filter` with a bad field → a calm ToolResult JSON string (NO raise).

    The handler catches `ResolveError` and maps it to a calm string so the agent loop
    survives — it must NEVER let an exception escape into the loop.
    """
    from app.services.tool_dispatcher import ToolResult, _handle_query_documents_by_view

    ctx = make_tool_context()
    bad_filter = {
        "op": "and",
        "conditions": [{"field": "_confidence", "op": "eq", "value": "x"}],  # reserved prefix
    }

    raised = None
    try:
        result = await _handle_query_documents_by_view({"filter": bad_filter}, ctx)
    except Exception as e:  # noqa: BLE001 — the anti-assertion: NOTHING may escape
        raised = e
        result = None

    assert raised is None, f"the handler must not raise — it raised {raised!r}"
    assert isinstance(result, ToolResult)
    payload = json.loads(result.result)
    assert "error" in payload or "message" in payload, (
        f"a bad filter must return a calm error string, got {payload}"
    )


@pytest.mark.asyncio
async def test_well_formed_inline_filter_routes_to_resolve(make_tool_context, monkeypatch):
    """A well-formed inline `filter` routes through `resolve_filter` (resolve mode)."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, _handle_query_documents_by_view

    called = {}

    async def _spy_resolve(*, caller, flt, folder_scope, count_only, supabase):
        called["hit"] = True
        called["caller"] = caller
        if count_only:
            return {"total": 0}
        return {"documents": [], "total": 0}

    # The handler imports resolve_filter from the resolver module — patch wherever it's bound.
    monkeypatch.setattr(td, "resolve_filter", _spy_resolve, raising=False)

    ctx = make_tool_context()
    good_filter = {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}]}
    result = await _handle_query_documents_by_view({"filter": good_filter}, ctx)
    assert isinstance(result, ToolResult)
    assert called.get("hit") is True, "a well-formed filter must reach resolve_filter"


@pytest.mark.asyncio
async def test_bad_limit_string_does_not_raise_into_loop(make_tool_context, monkeypatch):
    """WR-01: a non-numeric `limit` (e.g. {"limit": "twenty"}) must NOT raise into the agent
    loop. _normalize_optional_int coerces or returns None → the handler falls back to the
    default and still returns a calm ToolResult (T-115-02-05 — errors never escape)."""
    import app.services.tool_dispatcher as td
    from app.services.tool_dispatcher import ToolResult, _handle_query_documents_by_view

    async def _spy_resolve(*, caller, flt, folder_scope, count_only, supabase):
        return {"total": 0} if count_only else {"documents": [], "total": 0}

    monkeypatch.setattr(td, "resolve_filter", _spy_resolve, raising=False)

    ctx = make_tool_context()
    good_filter = {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "report"}]}

    raised = None
    try:
        result = await _handle_query_documents_by_view({"filter": good_filter, "limit": "twenty"}, ctx)
    except Exception as e:  # noqa: BLE001 — the anti-assertion: a bad limit may NOT escape
        raised = e
        result = None

    assert raised is None, f"a non-numeric limit must not raise — got {raised!r}"
    assert isinstance(result, ToolResult)


@pytest.mark.asyncio
async def test_catalog_db_error_returns_calm_string_not_raise(make_tool_context, monkeypatch):
    """WR-03: catalog is the FIRST path the model is told to call; a transient DB error in
    list_views/_build_field_meta must stay a calm ToolResult (status catalog_unavailable),
    never raise into the loop (the same contract the resolve path already honors)."""
    from app.services import document_view_service
    from app.services.tool_dispatcher import ToolResult, _handle_query_documents_by_view

    async def _boom(*a, **k):
        raise RuntimeError("postgrest unreachable")

    monkeypatch.setattr(document_view_service, "list_views", _boom)

    ctx = make_tool_context()
    raised = None
    try:
        result = await _handle_query_documents_by_view({}, ctx)  # empty args → catalog path
    except Exception as e:  # noqa: BLE001 — the anti-assertion
        raised = e
        result = None

    assert raised is None, f"a catalog DB error must not raise — got {raised!r}"
    assert isinstance(result, ToolResult)
    payload = json.loads(result.result)
    assert payload.get("status") == "catalog_unavailable", (
        f"a catalog DB error must return a calm catalog_unavailable string, got {payload}"
    )
