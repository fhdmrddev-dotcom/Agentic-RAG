"""Phase 158 Plan 01 (SC#2 / D-04) — SetupMiddleware gate + the byte-identical invariant.

Wave-0 Nyquist scaffold. Mirrors ``test_147_maintenance_mw.py`` exactly (the pure-ASGI
gate template): a tiny ``_make_app()`` wired with ONLY ``SetupMiddleware`` + dummy routes
covering every allowlist branch, driven by monkeypatching the middleware's finalized read
seam (``_is_finalized`` — the setup analog of maintenance's ``_read_maintenance``).

The behaviors this file pins (158-VALIDATION.md, SC#2/D-04):
  1. pre-finalize, a non-allowlisted route is gated -> 503 ``{"error":"setup_required"}``.
  2. the allowlist passes even pre-finalize: exact ``/health``, exact ``/public-config``,
     prefix ``/setup`` (covering ``/setup/status``, ``/setup/validate``, ...).
  3. segment-boundary safety: ``/setupx`` merely STARTS with ``/setup`` but is a DIFFERENT
     resource — it is NOT allowlisted (mirrors the ``/administrate`` proof at test_147:142).
  4. THE byte-identical invariant (``test_configured_box_noop``): once finalized (latched),
     ``SetupMiddleware`` is a literal passthrough — a configured box's hot path is a single
     bool check, zero I/O; every route behaves exactly as if the middleware weren't there.

``app.middleware.setup`` is a NEW module -> ``pytest.importorskip`` SKIPS the whole file
cleanly until Wave 1 lands it (0 collection errors). Wave 1 flips these green against the
real gate.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# app/middleware/setup.py landed in Wave 1 (Plan 158-03) — direct import (the module now
# exists, so the 158-01 importorskip guard is retired). ``setup_mw`` stays bound so the
# fixtures can monkeypatch its ``_is_finalized`` read seam.
import app.middleware.setup as setup_mw
from app.middleware.setup import SetupMiddleware


def _make_app() -> FastAPI:
    """A tiny app wired with ONLY SetupMiddleware + one dummy route per allowlist branch
    plus one normal (gated) route — exercised end-to-end without the real app's lifespan
    (Redis/Postgres) dependency (the test_147 idiom)."""
    application = FastAPI()
    application.add_middleware(SetupMiddleware)

    @application.get("/health")  # allowlist (exact) — public liveness
    async def health():
        return {"ok": True}

    @application.get("/public-config")  # allowlist (exact) — browser Supabase creds (D-07)
    async def public_config():
        return {"supabase_url": "x", "supabase_anon_key": "y"}

    @application.get("/setup/status")  # allowlist (prefix /setup) — the wizard's own API
    async def setup_status():
        return {"needs_setup": True}

    @application.post("/setup/validate")  # allowlist (prefix /setup)
    async def setup_validate():
        return {"ok": True}

    @application.get("/threads")  # a NORMAL route — gated pre-finalize, passes post-finalize
    async def threads():
        return {"ok": True}

    return application


@pytest.fixture
def pre_finalize_client(monkeypatch):
    """A GENUINELY-fresh box — NOT finalized AND infra still placeholder — the gate is active
    (blocks non-allowlisted routes). Both first-run seams are forced off."""
    monkeypatch.setattr(setup_mw, "_is_finalized", lambda: False)
    monkeypatch.setattr(setup_mw, "_is_configured_via_env", lambda: False)
    return TestClient(_make_app())


@pytest.fixture
def finalized_client(monkeypatch):
    """Setup finalized (latched) — the gate is a literal no-op (byte-identical)."""
    monkeypatch.setattr(setup_mw, "_is_finalized", lambda: True)
    return TestClient(_make_app())


@pytest.fixture
def configured_via_env_client(monkeypatch):
    """A box configured the pre-158 way — a REAL supabase_url in env, but NEVER ran the wizard
    (no finalize marker). This is every existing deploy + every local dev box. The gate MUST be
    a no-op here (the regression that 503'd configured boxes)."""
    monkeypatch.setattr(setup_mw, "_is_finalized", lambda: False)
    monkeypatch.setattr(setup_mw, "_is_configured_via_env", lambda: True)
    return TestClient(_make_app())


# ── 1. pre-finalize: a non-allowlisted route is gated → 503 setup_required ──────

def test_pre_finalize_blocks_non_allowlisted(pre_finalize_client):
    """SC#2/D-04: before finalize, a non-allowlisted route is gated → 503 with the plain
    ``{"error":"setup_required"}`` body directing the operator to /setup."""
    resp = pre_finalize_client.get("/threads")
    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "setup_required"


# ── 2. pre-finalize: the allowlist passes ──────────────────────────────────────

def test_pre_finalize_allows_health(pre_finalize_client):
    """SC#2/D-04: exact ``/health`` is allowlisted (the public liveness probe) — passes
    even before finalize so the container is observable while unbound."""
    assert pre_finalize_client.get("/health").status_code == 200


def test_pre_finalize_allows_public_config(pre_finalize_client):
    """SC#2/D-04: exact ``/public-config`` is allowlisted (D-07 — the browser needs the
    Supabase URL + anon key to render before setup completes)."""
    assert pre_finalize_client.get("/public-config").status_code == 200


def test_pre_finalize_allows_setup_prefix(pre_finalize_client):
    """SC#2/D-04: the ``/setup`` prefix is allowlisted — ``/setup/status`` (GET) and
    ``/setup/validate`` (POST write) both reach routing, never a 503."""
    assert pre_finalize_client.get("/setup/status").status_code == 200
    assert pre_finalize_client.post("/setup/validate").status_code != 503


# ── 3. segment-boundary safety (mirrors test_147 /administrate proof) ───────────

def test_setup_prefix_boundary_not_over_allowlisted(monkeypatch):
    """SC#2/D-04: a path that merely STARTS with the ``/setup`` token but is a different
    resource (``/setupx``) must NOT be allowlisted — it is gated → 503. The allowlist
    check is ``path == prefix or path.startswith(prefix + "/")``, not a bare prefix."""
    monkeypatch.setattr(setup_mw, "_is_finalized", lambda: False)
    monkeypatch.setattr(setup_mw, "_is_configured_via_env", lambda: False)
    app_extra = FastAPI()
    app_extra.add_middleware(SetupMiddleware)

    @app_extra.get("/setupx")
    async def setupx():
        return {"ok": True}

    client = TestClient(app_extra)
    assert client.get("/setupx").status_code == 503


# ── 3b. the configured-via-env regression: a real supabase_url + no marker → NO gate ──

def test_configured_via_env_is_never_gated(configured_via_env_client):
    """REGRESSION (the 503 an operator hit): a box configured the pre-158 way — a real
    supabase_url in env but no wizard finalize marker — must be a LITERAL passthrough, NOT
    503'd into setup mode. The gate keys off ``needs_setup`` (marker-absent AND
    infra-placeholder), so a real-infra box passes through even without a marker."""
    resp = configured_via_env_client.get("/threads")
    assert resp.status_code != 503
    assert resp.json() == {"ok": True}


# ── 4. THE byte-identical invariant — the load-bearing regression home ──────────

def test_configured_box_noop(finalized_client):
    """Byte-identical invariant (SC#2 / the load-bearing regression bar): once finalized
    (latched sticky-True), ``SetupMiddleware`` is a LITERAL passthrough — a configured box
    behaves exactly as if the middleware were absent (single bool check, zero I/O,
    RESEARCH Pattern 4).

    A normal route that would be 503'd pre-finalize now passes through untouched, and the
    allowlist routes are equally unaffected — no route's status/body changes because of
    the gate. This is the Deep-byte-identical analog (mirrors Phase 147's off-switch-safe
    MaintenanceMiddleware)."""
    r = finalized_client.get("/threads")
    assert r.status_code == 200
    assert r.json() == {"ok": True}  # untouched — exactly the router's own response
    # the allowlist routes are equally unaffected once finalized
    assert finalized_client.get("/health").status_code == 200
    assert finalized_client.get("/setup/status").status_code == 200


# ── 5. byte-identical INTEGRATION proof — the REAL app, end-to-end (plan-checker item 1) ──────

def test_configured_real_app_boot_byte_identical(monkeypatch):
    """Byte-identical INTEGRATION proof (SC#2 / D-17, plan-checker item 1): boot the REAL app
    (main.py wiring — SetupMiddleware registered before CORS + the setup routers included), force
    the setup-store finalized marker True, and prove the gate is a LITERAL passthrough end-to-end
    — not just the mini-`_make_app` middleware-unit proof above.

    - ``/health`` keeps its EXACT pre-158 shape (``{status, redis, maintenance}``) — the wiring
      adds no key and changes no status.
    - a NON-allowlisted route (``/models``) that WOULD be 503'd pre-finalize now serves normally —
      the empirical end-to-end proof that a CONFIGURED box behaves as if the gate were absent.

    Bare ``TestClient`` (NOT a context manager) so the request runs WITHOUT the app lifespan
    (the test_147 idiom — no Postgres/Redis dependency); the middleware still runs per request."""
    import app.services.setup_store as store

    # the real gate authority the middleware reads -> finalized; force a fresh latch read so the
    # patched marker (not a leaked sticky-True) drives this proof.
    monkeypatch.setattr(store, "setup_finalized", lambda: True)
    monkeypatch.setattr(setup_mw, "_finalized_latch", False)

    from app.main import app as real_app

    client = TestClient(real_app)  # bare — no lifespan (test_147 idiom)

    resp = client.get("/health")
    assert resp.status_code == 200
    assert set(resp.json().keys()) == {"status", "redis", "maintenance"}  # exact pre-158 shape

    # a NON-allowlisted route passes through untouched once finalized (a true no-op, not allowlist)
    assert client.get("/models").status_code == 200
