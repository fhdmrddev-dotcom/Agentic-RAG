"""Phase 115 Wave-0 — resolver-extraction RED scaffold (Plan 01 GREEN target).

These assertions are the Plan-01 (Task 2/3) GREEN target — they are un-xfailed as
the extraction lands. They prove the leak-safe resolve core has been lifted out of
the FastAPI route module `app.api.document_views` into an injectable service module
`app.services.document_view_resolver` that:

  * exports `resolve_filter` + `ResolveError`,
  * imports NO FastAPI (no `HTTPException` symbol on the module — `assert "fastapi"
    not in sys.modules` is unreliable, so we assert the module surface instead),
  * carries `.detail` + `.status` on `ResolveError`,
  * raises a plain `ResolveError` (NOT `HTTPException`) on a bad-field inline filter
    driven through `resolve_filter`.

All imports are INSIDE the test bodies so collection never errors on a missing
`document_view_resolver` module while it is still RED.
"""

import pytest


def test_resolver_module_exports_public_api():
    """`resolve_filter` + `ResolveError` import from the extracted service module."""
    from app.services.document_view_resolver import ResolveError, resolve_filter  # noqa: F401

    assert callable(resolve_filter)
    assert issubclass(ResolveError, Exception)


def test_resolver_module_imports_no_fastapi():
    """The extracted core must NOT depend on FastAPI — no HTTPException symbol.

    `assert "fastapi" not in sys.modules` is unreliable (another module under test
    may have imported it), so we assert the module's own surface carries no
    `HTTPException` (it raises a plain ResolveError instead).
    """
    import app.services.document_view_resolver as m

    assert not hasattr(m, "HTTPException"), "resolver must not import FastAPI HTTPException"
    assert not hasattr(m, "status"), "resolver must not import fastapi.status"


def test_resolve_error_carries_detail_and_status():
    """`ResolveError` carries a `.detail` string and a `.status` int (default 422)."""
    from app.services.document_view_resolver import ResolveError

    err = ResolveError(detail="bad field 'x'")
    assert err.detail == "bad field 'x'"
    assert err.status == 422

    explicit = ResolveError(detail="nope", status=400)
    assert explicit.status == 400


@pytest.mark.xfail(strict=False, reason="Plan 01 Task 2 + a live whitelist make this raise ResolveError")
@pytest.mark.asyncio
async def test_bad_field_inline_filter_raises_resolve_error_not_httpexception():
    """A bad-field inline filter driven through `resolve_filter` raises `ResolveError`.

    The extracted core raises a PLAIN `ResolveError` — never `HTTPException` (which
    would leak FastAPI into the agent loop). This test stays xfail until both the
    module exists (Task 2) AND a whitelist source is reachable; the secure-phase
    live suite is the non-vacuous proof.
    """
    from fastapi import HTTPException

    from app.services.document_view_resolver import ResolveError, resolve_filter
    from app.models.document_view import ViewCondition, ViewFilter

    flt = ViewFilter(
        op="and",
        conditions=[ViewCondition(field="_confidence", op="eq", value="x")],  # reserved prefix
    )

    class _StubSupabase:  # minimal stand-in; the bad field rejects before any query
        def table(self, *_a, **_k):
            raise AssertionError("a bad-field filter must reject BEFORE touching the DB")

    raised = None
    try:
        await resolve_filter(
            caller="00000000-0000-0000-0000-000000000001",
            flt=flt,
            folder_scope=None,
            count_only=True,
            supabase=_StubSupabase(),
        )
    except ResolveError as e:  # the contract
        raised = e
    except HTTPException:  # pragma: no cover — the explicit anti-assertion
        pytest.fail("resolve_filter raised HTTPException — it must raise ResolveError")

    assert raised is not None, "a bad-field filter must raise ResolveError"
    assert "_confidence" in raised.detail or "reserved" in raised.detail.lower()
