"""Phase 149 Plan 05 (MODEL-01 / SC#4 / D-149-09, T-149-10) — the model-route gate.

Mirrors tests/test_146_operator_gate.py: a non-operator JWT gets a BYTE-IDENTICAL 404 on
every /admin/models* route (GET registry, PATCH capability — and the POST discover route
once Plan 06 adds it). There is NO RLS backstop on the admin write path — the router-level
``require_operator`` gate is the sole authority, so this contract is load-bearing.

Membership reads are asyncpg (``get_pg_pool``): drive the non-operator branch by patching
``app.dependencies._pg_pool`` → ``mock_asyncpg_pool`` with ``set_fetchrow_result(None)``.
"""
from app.main import app


def _admin_model_paths():
    """Every registered /admin/models* route path (current + future, e.g. discover)."""
    seen = set()
    for r in app.routes:
        path = getattr(r, "path", "")
        if path.startswith("/admin/models"):
            seen.add(path)
    return seen


def test_get_models_404_for_non_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """GET /admin/models → byte-identical 404 for a non-operator (non-discoverable)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # operator_users lookup → no row
    res = client.get("/admin/models", headers=auth_headers)
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}  # byte-identical body
    assert "application/json" in res.headers.get("content-type", "")


def test_patch_model_404_for_non_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """PATCH /admin/models/{id} → byte-identical 404 for a non-operator (no write reached)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)
    res = client.patch("/admin/models/gpt-4o", headers=auth_headers, json={"enabled": False})
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}
    # No upsert may have run — the gate 404'd before the handler.
    upserts = [c for c in mock_asyncpg_pool.calls
               if "model_capabilities_overrides" in c[0] and "INSERT" in c[0].upper()]
    assert not upserts, "the gate must 404 a non-operator BEFORE any capability write"


def test_model_404_matches_unknown_route_404(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The gated /admin/models 404 is byte-identical to FastAPI's unknown-route 404."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)
    gated = client.get("/admin/models", headers=auth_headers)
    unknown = client.get("/admin/__definitely_not_a_route__", headers=auth_headers)
    assert gated.status_code == unknown.status_code == 404
    assert gated.json() == unknown.json() == {"detail": "Not Found"}


def test_every_model_route_registered_under_gate(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """Route-enumeration backstop: EVERY /admin/models* GET path 404s for a non-operator,
    so a future model route (e.g. Plan 06's POST discover, when it also serves GET) can
    never forget the router gate."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)
    paths = _admin_model_paths()
    assert "/admin/models" in paths, "the registry read route must be registered"
    # GET every model path; the router gate 404s a non-operator regardless of method match.
    get_route_paths = {
        getattr(r, "path", "")
        for r in app.routes
        if getattr(r, "path", "").startswith("/admin/models") and "GET" in (getattr(r, "methods", set()) or set())
    }
    for path in get_route_paths:
        url = path.replace("{model_id}", "gpt-4o")
        res = client.get(url, headers=auth_headers)
        assert res.status_code == 404, f"{path} leaked (expected 404 for non-operator)"
        assert res.json() == {"detail": "Not Found"}
