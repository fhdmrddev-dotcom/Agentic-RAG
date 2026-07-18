"""Phase 147 Plan 05 (FLAG-01 / D-06) — maintenance write-block middleware suite.

Proves the single middleware seam is off-switch-safe and OPEN-by-default:

  1. maintenance ON  -> a non-allowlisted POST/PUT/PATCH/DELETE gets a plain 503
     {"error":"maintenance","message":"maintenance mode — read-only"}.
  2. GET/HEAD/OPTIONS always pass (reads + CORS preflight), maintenance on or off.
  3. The off-switch-safe allowlist (Pitfall 4 — MUST be exactly right): any /auth/*,
     ALL /admin/* (so PUT /admin/flags can always turn maintenance back OFF), and
     DELETE /runs/{id} (users self-cancelling) ALWAYS pass even under maintenance.
  4. maintenance OFF (including a cold cache) -> every method passes (D-Q4 OPEN):
     a settings blip must NEVER wedge the whole platform read-only.
  5. No blocking supabase call in the middleware (D-v2.5-01) — asserted by source grep.
  6. The public /health payload carries an additive `maintenance` boolean so the
     end-user (non-operator) banner has a public flag source without hitting /admin.

The middleware is exercised END-TO-END against a tiny app wired with only the
MaintenanceMiddleware (no lifespan / DB dependency); the maintenance flag is driven
through the middleware's in-memory read seam (`_read_maintenance`) or the real
per-worker settings cache (for the cold-cache polarity proof).
"""
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.testclient import TestClient

import app.middleware.maintenance as mw
from app.middleware.maintenance import MaintenanceMiddleware


def _make_app() -> FastAPI:
    """A tiny app wired with ONLY the maintenance middleware + dummy routes covering
    every allowlist branch, so the middleware is exercised end-to-end without the
    real app's lifespan (Redis/Postgres) dependency."""
    application = FastAPI()
    application.add_middleware(MaintenanceMiddleware)

    @application.get("/read")
    async def read():
        return {"ok": True}

    @application.post("/write")
    async def write_post():
        return {"ok": True}

    @application.put("/write")
    async def write_put():
        return {"ok": True}

    @application.patch("/write")
    async def write_patch():
        return {"ok": True}

    @application.delete("/write")
    async def write_delete():
        return {"ok": True}

    @application.post("/auth/login")
    async def login():
        return {"ok": True}

    @application.put("/admin/flags")
    async def admin_flags():  # the off-switch — MUST stay reachable in maintenance
        return {"ok": True}

    @application.post("/admin/runs/abc/kill")
    async def admin_kill():
        return {"ok": True}

    @application.delete("/runs/{run_id}")
    async def cancel_run(run_id: str):  # self-cancel — MUST stay reachable
        return Response(status_code=204)

    return application


@pytest.fixture
def on_client(monkeypatch):
    """A client with maintenance forced ON via the middleware's in-memory read seam."""
    monkeypatch.setattr(mw, "_read_maintenance", lambda: True)
    return TestClient(_make_app())


@pytest.fixture
def off_client(monkeypatch):
    """A client with maintenance forced OFF."""
    monkeypatch.setattr(mw, "_read_maintenance", lambda: False)
    return TestClient(_make_app())


# ── 1. maintenance ON blocks a non-allowlisted mutating request ────────────────

@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_maintenance_on_blocks_non_allowlisted_writes(on_client, method):
    resp = getattr(on_client, method)("/write")
    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "maintenance"
    assert body["message"] == "maintenance mode — read-only"


# ── 2. GET/HEAD/OPTIONS always pass under maintenance ──────────────────────────

def test_get_passes_under_maintenance(on_client):
    resp = on_client.get("/read")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_head_and_options_pass_under_maintenance(on_client):
    # HEAD/OPTIONS are passthrough methods — the middleware must never 503 them. (The
    # router itself may 405 when no HEAD/OPTIONS handler is declared; that only proves
    # the request reached routing, i.e. the middleware let it through.)
    assert on_client.head("/read").status_code != 503
    assert on_client.options("/read").status_code != 503


# ── 3. The off-switch-safe allowlist passes under maintenance (Pitfall 4) ───────

def test_auth_login_passes_under_maintenance(on_client):
    assert on_client.post("/auth/login").status_code != 503


def test_admin_flags_off_switch_passes_under_maintenance(on_client):
    # PUT /admin/flags is the off-switch — if the middleware blocked it, maintenance
    # would be a one-way trap. It MUST stay reachable.
    assert on_client.put("/admin/flags").status_code != 503


def test_admin_any_write_passes_under_maintenance(on_client):
    assert on_client.post("/admin/runs/abc/kill").status_code != 503


def test_self_cancel_delete_run_passes_under_maintenance(on_client):
    resp = on_client.delete("/runs/some-run-id")
    assert resp.status_code != 503
    assert resp.status_code == 204


def test_admin_prefix_boundary_not_over_allowlisted(on_client):
    # A path that merely STARTS with the allowlist token but is a different resource
    # (e.g. /administrate) must NOT be allowlisted — it is blocked under maintenance.
    app_extra = _make_app()

    @app_extra.post("/administrate")
    async def administrate():
        return {"ok": True}

    client = TestClient(app_extra)
    assert client.post("/administrate").status_code == 503


# ── 4. maintenance OFF -> everything passes ────────────────────────────────────

@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_maintenance_off_all_methods_pass(off_client, method):
    assert getattr(off_client, method)("/write").status_code != 503


# ── 5. cold-cache read defaults OPEN (D-Q4) — real reader, no monkeypatch ───────

def test_cold_cache_defaults_open(monkeypatch):
    """A truly-cold settings cache reads maintenance False (OPEN) — a blip never wedges
    the platform. Exercises the REAL `_read_maintenance` -> `maintenance_mode()` path."""
    import app.models.user_settings as us
    monkeypatch.setattr(us, "_settings_cache", None, raising=False)
    monkeypatch.setattr(us, "_settings_cache_time", 0.0, raising=False)

    # The real sync helper on a cold cache reads False (platform OPEN, D-Q4).
    assert mw._read_maintenance() is False

    # End-to-end: with the real reader + a cold cache, a write is NOT blocked.
    client = TestClient(_make_app())
    assert client.post("/write").status_code != 503


# ── 6. no blocking supabase call in the middleware source (D-v2.5-01) ──────────

def test_middleware_source_has_no_supabase_table_call():
    src = Path(mw.__file__).read_text(encoding="utf-8")
    assert "supabase.table(" not in src


# ── 7. the public /health payload carries an additive maintenance boolean ──────

def test_health_exposes_maintenance_boolean():
    from app.main import app as main_app

    # Bare TestClient (NOT a context manager) -> the request runs without triggering
    # the app lifespan, so this stays a unit test (no Postgres drift-guard dependency).
    client = TestClient(main_app)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert "maintenance" in body
    assert isinstance(body["maintenance"], bool)


def test_health_maintenance_reflects_flag(monkeypatch):
    import time as _t

    import app.models.user_settings as us
    monkeypatch.setattr(us, "_settings_cache", {"maintenance_mode": True}, raising=False)
    monkeypatch.setattr(us, "_settings_cache_time", _t.time(), raising=False)

    from app.main import app as main_app
    client = TestClient(main_app)
    body = client.get("/health").json()
    assert body["maintenance"] is True
