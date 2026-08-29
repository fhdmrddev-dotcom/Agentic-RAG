"""GET /documents/{id}/queries — Phase 217 (LIB-04, D-217-06 / D-217-07).

"The questions that found it", derived from the ``audit_log`` ``search.query`` rows the retrieval
path already writes. The route holds a CLASSIFIED service-role client, so RLS is bypassed by
construction and the application-level ``.eq("user_id", ...)`` is the SOLE gate (T-217-10 /
T-217-11). That gate is therefore asserted from the mock's OWN call log — never by reading the
handler and believing it — plus a source fence (with a non-vacuity control) proving no user id is
ever read from the request.
"""
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from tests.conftest import mock_user_data

DOC_ID = "eecf1fea-eeb5-4216-a028-65598de01e47"
OTHER_DOC_ID = "11111111-2222-3333-4444-555555555555"

SOURCE_PATH = Path(__file__).resolve().parents[1] / "app" / "api" / "document_queries.py"
SOURCE = SOURCE_PATH.read_text(encoding="utf-8")


# ── Helpers (the test_knowledge_health.py `_audit_row` style) ─────────────────

def _make_result(data):
    r = MagicMock()
    r.data = data
    r.count = len(data)
    return r


def _audit_row(document_ids, query_text="what did the contractor quote?",
               created_at="2026-08-28T10:00:00+00:00", via=None):
    meta = {"document_ids": document_ids}
    if query_text is not None:
        meta["query_text"] = query_text
    if via is not None:
        meta["via"] = via
    return {"metadata": meta, "created_at": created_at}


def _approx_cutoff(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


@pytest.fixture(autouse=True)
def _wire_contains(mock_builder):
    """conftest's shared builder predates the jsonb-containment filter — keep the chain fluent.

    Without this, ``.contains(...)`` returns a fresh auto-child MagicMock and the chain silently
    stops being the builder, which would make every case below pass for the wrong reason.
    """
    mock_builder.contains.return_value = mock_builder
    yield


# ── 1 · 200 shape ─────────────────────────────────────────────────────────────

def test_returns_the_questions_that_found_this_document(client, auth_headers, mock_execute_result):
    mock_execute_result.data = [
        _audit_row([DOC_ID], query_text="what did the contractor quote?"),
        _audit_row([DOC_ID, OTHER_DOC_ID], query_text="rebar rates",
                   created_at="2026-08-27T09:00:00+00:00"),
    ]
    res = client.get(f"/documents/{DOC_ID}/queries", headers=auth_headers)
    assert res.status_code == 200, res.text

    body = res.json()
    assert isinstance(body, list)
    assert len(body) == 2
    assert set(body[0]) == {"query_text", "asked_at", "via"}
    assert body[0]["query_text"] == "what did the contractor quote?"
    assert body[0]["via"] is None
    assert body[0]["asked_at"].startswith("2026-08-28T10:00:00")


# ── 2 · The D-217-07 gate, asserted from the mock's own call log ──────────────

def test_user_id_filter_is_applied_in_the_sql(client, auth_headers, mock_execute_result,
                                              mock_builder):
    """T-217-10: RLS is bypassed here, so `.eq("user_id", ...)` is the SOLE gate."""
    mock_execute_result.data = []
    res = client.get(f"/documents/{DOC_ID}/queries", headers=auth_headers)
    assert res.status_code == 200

    eq_calls = mock_builder.eq.call_args_list
    user_id_calls = [c for c in eq_calls if mock_user_data["id"] in list(c.args)]
    assert user_id_calls, (
        "expected an .eq(\"user_id\", <caller id>) filter in the SQL — the service-role client "
        f"bypasses RLS, so this is the sole gate. eq calls were: {eq_calls}"
    )
    assert "user_id" in list(user_id_calls[0].args), (
        f"the user_id filter must name the user_id column; got {user_id_calls[0].args}"
    )
    # It is the FIRST filter in the chain, exactly as the shipped knowledge_health read is.
    assert list(eq_calls[0].args) == ["user_id", mock_user_data["id"]], (
        f"user_id must be the FIRST eq filter; first eq was {eq_calls[0].args}"
    )
    # ...and the action_type narrowing is still there beside it.
    assert any(list(c.args) == ["action_type", "search.query"] for c in eq_calls), (
        f"expected an action_type=search.query filter; eq calls were: {eq_calls}"
    )


_HOSTILE_PATTERNS = [
    r"user_id\s*:\s*[A-Za-z_\[\]|. ]+=",   # a path/query parameter named user_id
    r"user_id\s*=\s*Query\(",
    r"user_id\s*=\s*Body\(",
    r"user_id\s*=\s*Header\(",
    r"user_id\s*=\s*request\.",
    r"user_id\s*=\s*payload",
    r"user_id\s*=\s*body",
]


def _fence_hits(source: str) -> list[str]:
    return [p for p in _HOSTILE_PATTERNS if re.search(p, source)]


def test_user_id_is_never_read_from_the_request():
    """The stronger arm: the handler cannot be told who it is by the caller.

    ⛔ `document_id` is a SELECTOR (T-217-11). If a user id could ride the request, the sole gate
    would be caller-controlled and the carve-out would leak every user's audit rows.
    """
    assert _fence_hits(SOURCE) == [], (
        f"user_id must come from current_user only; request-shaped reads found: {_fence_hits(SOURCE)}"
    )
    assert 'user_id = current_user["id"]' in SOURCE, (
        "expected the user id to be taken from current_user"
    )

    # Non-vacuity control: the fence must actually fire on a hostile handler.
    hostile = "\n".join([
        "    user_id: str = None,",
        "    user_id = Query(None)",
        "    user_id = Body(None)",
        "    user_id = Header(None)",
        "    user_id = request.query_params['user_id']",
        "    user_id = payload['user_id']",
        "    user_id = body['user_id']",
    ])
    assert len(_fence_hits(hostile)) == len(_HOSTILE_PATTERNS), (
        "the source fence is vacuous — it does not fire on a handler that reads user_id "
        f"from the request. Fired on: {_fence_hits(hostile)}"
    )


# ── 3 · A view-sourced row carries no question, and must not become "undefined" ──

def test_view_row_without_query_text_returns_none_not_undefined(client, auth_headers,
                                                                mock_execute_result):
    """D-115-10 rows (`via`:"view"/"filter") record no query_text — return None, honestly."""
    mock_execute_result.data = [
        _audit_row([DOC_ID], query_text=None, via="view"),
        _audit_row([DOC_ID], query_text=None, via="filter",
                   created_at="2026-08-26T08:00:00+00:00"),
    ]
    res = client.get(f"/documents/{DOC_ID}/queries", headers=auth_headers)
    assert res.status_code == 200, res.text

    body = res.json()
    assert [r["query_text"] for r in body] == [None, None]
    assert [r["via"] for r in body] == ["view", "filter"]
    assert "undefined" not in res.text, (
        "the route must never emit a placeholder question — the client renders the honest sentence"
    )


# ── 4 · The Python guard, not just `.contains`, decides ───────────────────────

def test_rows_for_another_document_are_excluded_by_the_python_guard(client, auth_headers,
                                                                    mock_execute_result,
                                                                    mock_builder):
    """Fetch-then-filter is belt-and-braces: a containment miss can never widen the result."""
    mock_execute_result.data = [
        _audit_row([DOC_ID], query_text="mine"),
        _audit_row([OTHER_DOC_ID], query_text="someone else's document"),
        {"metadata": None, "created_at": "2026-08-25T08:00:00+00:00"},
        {"metadata": {}, "created_at": "2026-08-24T08:00:00+00:00"},
    ]
    res = client.get(f"/documents/{DOC_ID}/queries", headers=auth_headers)
    assert res.status_code == 200, res.text

    body = res.json()
    assert [r["query_text"] for r in body] == ["mine"]
    assert "someone else's document" not in res.text

    # And the shipped arm IS the containment filter (assumption A1 verified against the live
    # local DB: contains agreed with the python guard, 48 == 48, zero misses).
    assert mock_builder.contains.call_args is not None, "expected a jsonb containment filter"
    assert list(mock_builder.contains.call_args.args) == [
        "metadata", {"document_ids": [DOC_ID]}
    ], f"unexpected containment filter: {mock_builder.contains.call_args}"


# ── 5 · Registration non-regression ──────────────────────────────────────────

def test_mounting_the_router_does_not_shadow_get_documents(client, auth_headers,
                                                           mock_execute_result):
    """The new router shares the /documents prefix — no existing /documents route may be lost."""
    mock_execute_result.data = []
    res = client.get("/documents", headers=auth_headers)
    assert res.status_code == 200, res.text
    assert res.json() == []


def test_route_is_registered_exactly_once():
    from app.main import app

    paths = [r.path for r in app.routes if getattr(r, "path", None) == "/documents/{document_id}/queries"]
    assert len(paths) == 1, f"expected exactly one mount, got {len(paths)}"


# ── 6 · Sketch fence A6e — the window is 30 days, from ONE constant ──────────

def test_window_is_thirty_days_from_the_shared_constant(client, auth_headers,
                                                        mock_execute_result, mock_builder):
    from app.api.document_queries import WINDOW_DAYS

    assert WINDOW_DAYS == 30

    mock_execute_result.data = []
    res = client.get(f"/documents/{DOC_ID}/queries", headers=auth_headers)
    assert res.status_code == 200

    gte_call = mock_builder.gte.call_args
    assert gte_call is not None, "expected a created_at window filter"
    assert gte_call.args[0] == "created_at"
    cutoff = datetime.fromisoformat(gte_call.args[1])
    expected = _approx_cutoff(30)
    assert abs((cutoff - expected).total_seconds()) < 5, (
        f"cutoff {cutoff} is not the 30-day window fence A6e labels; expected ~{expected}"
    )


# ── 7 · The classified exception is declared, once ───────────────────────────

def test_the_service_role_exception_is_declared_in_the_module_docstring():
    import app.api.document_queries as module

    doc = module.__doc__ or ""
    for needle in ("audit_log", "no authenticated SELECT policy", "ONE auditable rationale"):
        assert needle in doc, f"module docstring is missing {needle!r}"
    assert SOURCE.count("SERVICE-ROLE (classified)") >= 1, (
        "the Depends(get_supabase) parameter must carry the shipped inline classification comment"
    )
    assert ".execute()" not in SOURCE, (
        "every query must go through `await aexec(...)` — blocking I/O in an async handler"
    )
