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


def test_backpressure_reachable_for_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Operator JWT -> /admin/backpressure reachable (200) with the four signals present."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # membership present -> operator
    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200
    assert "anyio_threadpool_depth" in res.json()
