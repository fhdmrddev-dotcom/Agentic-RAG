"""Phase 146 (ADMIN-01) — operator gate regression suite.

The by-construction non-discoverability contract:
  - a non-operator JWT gets a byte-identical 404 on EVERY current AND future /admin
    route (route-enumeration — a new /admin endpoint can never forget the gate);
  - that 404 is byte-identical to FastAPI's unknown-route 404 (non-discoverable, A1);
  - an operator reaches the gated endpoints (200);
  - the audit floor writes exactly ONE row per gated ACTION endpoint and ZERO for the
    ``GET /admin/me`` mount probe (Pitfall 4 — probes must not spam the ledger).

Membership reads are asyncpg (``get_pg_pool``): drive the non-operator branch by
patching ``app.dependencies._pg_pool`` -> ``mock_asyncpg_pool`` with
``set_fetchrow_result(None)``; the operator branch with a truthy row. NEVER drive
membership via the supabase builder mock — it has zero effect on the asyncpg path,
and an unmocked read would hit the REAL local Postgres (Pitfall 6 / plan interfaces).
"""
from app.main import app


def _admin_get_paths():
    """Enumerate every registered /admin route that serves GET (current + future)."""
    seen = []
    for r in app.routes:
        path = getattr(r, "path", "")
        methods = getattr(r, "methods", set()) or set()
        if path.startswith("/admin") and "GET" in methods:
            seen.append(path)
    return seen


def test_every_admin_route_404s_for_non_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Non-operator JWT -> byte-identical 404 on EVERY /admin GET route."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # operator_users lookup -> no row
    paths = _admin_get_paths()
    assert paths, "expected at least one /admin GET route to enumerate"
    for path in paths:
        url = path.replace("{run_id}", "00000000-0000-0000-0000-000000000000")
        res = client.get(url, headers=auth_headers)
        assert res.status_code == 404, f"{path} leaked (expected 404 for non-operator)"
        assert res.json() == {"detail": "Not Found"}  # byte-identical body
        assert "application/json" in res.headers.get("content-type", "")


def test_admin_404_matches_unknown_route_404(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The gated-route 404 is byte-identical to FastAPI's unknown-route 404 (A1)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)
    gated = client.get("/admin/backpressure", headers=auth_headers)  # exists, gated
    unknown = client.get("/admin/__definitely_not_a_route__", headers=auth_headers)  # unknown
    assert gated.status_code == unknown.status_code == 404
    assert gated.json() == unknown.json() == {"detail": "Not Found"}
    assert "application/json" in gated.headers.get("content-type", "")


def test_audit_floor_fallback_derives_write_verb_from_method():
    """WR-03: the route-derived audit fallback reflects the HTTP method.

    A future POST/DELETE /admin endpoint that forgets the explicit
    request.state.audit_* enrichment must NOT be recorded as a harmless
    '<area>.view' read. The fallback derives 'view' for GET and 'write' for any
    mutating method, and the is_write floor is method-derived — so the floor never
    under-reports the destructive actions it exists to catch.
    """
    from types import SimpleNamespace

    from app.dependencies import _WRITE_METHODS, _derive_action

    get_req = SimpleNamespace(url=SimpleNamespace(path="/admin/users"), method="GET")
    assert _derive_action(get_req) == "users.view"

    for method in ("POST", "PUT", "PATCH", "DELETE"):
        write_req = SimpleNamespace(url=SimpleNamespace(path="/admin/users"), method=method)
        assert _derive_action(write_req) == "users.write", method
        assert method in _WRITE_METHODS

    # A known path still wins from the label map regardless of method.
    known = SimpleNamespace(url=SimpleNamespace(path="/admin/backpressure"), method="POST")
    assert _derive_action(known) == "health.view"


def test_unauthenticated_admin_matches_unknown_route_404(client):
    """WR-02: an /admin request with NO Authorization header is byte-identical to an
    unknown-route 404 — NOT a 403 — so the non-discoverability contract holds pre-auth.

    Pops the conftest ``authenticate_operator_request`` override so the REAL
    auto_error=False resolver runs: an absent header yields ``None`` credentials ->
    ``_NOT_FOUND``. Falsifiable against the old shared bearer_scheme(auto_error=True),
    which returned 403 "Not authenticated" here and let an anonymous scanner tell a
    gated /admin route apart from a nonexistent one.
    """
    from app.dependencies import authenticate_operator_request

    app.dependency_overrides.pop(authenticate_operator_request, None)
    gated = client.get("/admin/backpressure")  # exists, gated — NO auth header
    unknown = client.get("/admin/__definitely_not_a_route__")  # unknown — NO auth header

    assert gated.status_code == unknown.status_code == 404
    assert gated.json() == unknown.json() == {"detail": "Not Found"}
    assert "application/json" in gated.headers.get("content-type", "")
    # (reset_mocks re-installs the override before the next test.)


def test_backpressure_reachable_for_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Operator JWT -> /admin/backpressure reachable (200) with the four signals present."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # membership present -> operator
    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200
    assert "anyio_threadpool_depth" in res.json()


def test_audit_floor_writes_once(client, auth_headers, mock_asyncpg_pool, mock_builder, monkeypatch):
    """A gated ACTION endpoint writes exactly ONE audit row; poll/probe GETs write ZERO.

    Drive the operator branch via the asyncpg pool mock (NOT the require_operator
    override) so the real gate sets request.state.operator and the floor teardown
    actually fires. The audit WRITE goes through the injected shared Supabase mock.

    Phase 147 D-07: ``/admin/backpressure`` was DEMOTED to floor-EXEMPT (the Control
    Plane auto-polls it ~10s; logging every poll would spam the ledger — it now joins
    ``/admin/me`` as an exempt GET). The still-floor-attached ``/admin/audit`` is the
    canonical "gated action endpoint" example here; the poll/probe exemption is asserted
    against BOTH ``/admin/me`` and ``/admin/backpressure``.
    """
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # operator present

    # Action endpoint (/admin/audit) -> floor writes exactly one row.
    res = client.get("/admin/audit", headers=auth_headers)
    assert res.status_code == 200
    op_inserts = [
        c for c in mock_builder.insert.call_args_list
        if c.args and isinstance(c.args[0], dict) and "action" in c.args[0] and "label" in c.args[0]
    ]
    assert len(op_inserts) == 1, "a gated action endpoint must write exactly one operator_audit_log row"
    assert op_inserts[0].args[0]["action"] == "audit.view"
    assert op_inserts[0].args[0]["label"] == "Viewed recent actions"

    # Poll/probe GETs are floor-EXEMPT -> ZERO audit rows (Pitfall 4 / D-07).
    for exempt_path in ("/admin/me", "/admin/backpressure"):
        mock_builder.reset_mock()
        probe = client.get(exempt_path, headers=auth_headers)
        assert probe.status_code == 200
        probe_inserts = [
            c for c in mock_builder.insert.call_args_list
            if c.args and isinstance(c.args[0], dict) and "action" in c.args[0]
        ]
        assert len(probe_inserts) == 0, f"{exempt_path} is floor-exempt and must not write an audit row"
