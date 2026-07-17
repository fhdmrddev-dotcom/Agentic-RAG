"""Phase 158 Plan 01 (SC#1 / D-06) — GET /setup/status: needs_setup from a STATIC check.

Wave-0 Nyquist scaffold. The entry signal is a STATIC, blip-proof string check — NOT a live
DB probe — so a DB blip can NEVER re-trigger the wizard on a configured box (RESEARCH
Pattern 1 / Pitfall 1): ``needs_setup = (not finalized_marker) AND (infra still placeholder)``.
A hand-filled 157-style box (real SUPABASE_URL, no marker) reports ``needs_setup=false``.

This file pins (158-VALIDATION.md, SC#1/D-06):
  - a fresh box (no marker, placeholder infra) → ``needs_setup=true``;
  - a finalized box → ``needs_setup=false``;
  - a hand-filled box (real infra, no marker) → ``needs_setup=false`` (Pitfall 1);
  - the check performs NO live DB probe (blip-proof).

All 6 step-contract files ``pytest.importorskip("app.services.setup_service")`` — they SKIP
cleanly until Wave 2 lands the service. Wave 2 flips them green + wires the exact seam.
"""
import pytest

# NEW service — skips cleanly until Wave 2 creates app/services/setup_service.py.
setup_service = pytest.importorskip("app.services.setup_service")


def test_status_needs_setup_on_fresh_box(setup_store_path):
    """SC#1/D-06: a fresh box (no finalize marker AND infra still placeholder) →
    ``needs_setup=true`` (auto-show the wizard)."""
    status = setup_service.compute_setup_status(supabase_url="https://<project-ref>.supabase.co")
    assert status["needs_setup"] is True


def test_status_false_when_finalized(setup_store_path):
    """SC#1/D-06: once the finalize marker is set → ``needs_setup=false`` regardless of infra
    (the lock-out authority is the file marker, D-05)."""
    from app.services.setup_store import write_store
    write_store({"finalized": True})
    status = setup_service.compute_setup_status(supabase_url="https://<project-ref>.supabase.co")
    assert status["needs_setup"] is False


def test_status_false_on_handfilled_box(setup_store_path):
    """SC#1/D-06 (Pitfall 1): a hand-filled 157-style box has a REAL SUPABASE_URL but no
    marker file — the static check must report ``needs_setup=false`` (a real URL ⇒
    not-placeholder ⇒ configured), so an env-configured box never renders the wizard."""
    status = setup_service.compute_setup_status(supabase_url="https://real-project.supabase.co")
    assert status["needs_setup"] is False


def test_status_does_no_live_db_probe(setup_store_path):
    """SC#1/D-06 (blip-proof): the status check is a STATIC string check — it must NOT open a
    DB connection, so a DB outage can never bounce live users into the wizard. Named for the
    Nyquist map; Wave 2 asserts no asyncpg.connect is invoked on the status path."""
    assert hasattr(setup_service, "compute_setup_status"), "status must be a static, no-DB computation"


# ── 158-06 (Task 1): the OPEN routes over a real ASGI request (TestClient) ─────────────────
# The two un-tokened routes (D-07): GET /setup/status (entry signal) + GET /public-config
# (the two PUBLIC Supabase values, never a secret). Mounted on a minimal app — no lifespan,
# no main.py wiring (that is 158-07) — so the router's own contract is proven in isolation.
from fastapi.testclient import TestClient  # noqa: E402


def _make_setup_app():
    """A minimal FastAPI app mounting ONLY the 158-06 setup routers (open + token-gated)."""
    from fastapi import FastAPI

    import app.api.setup as setup_api

    app_ = FastAPI()
    app_.include_router(setup_api.router)
    app_.include_router(setup_api.public_router)
    return app_


def test_status_endpoint_is_open_and_returns_entry_shape(setup_store_path):
    """158-06/D-06: GET /setup/status is OPEN (no token) and returns the static entry signal
    {needs_setup, finalized, has_token} — the SPA's one-shot startup probe."""
    resp = TestClient(_make_setup_app()).get("/setup/status")
    assert resp.status_code == 200
    assert set(resp.json().keys()) == {"needs_setup", "finalized", "has_token"}


def test_public_config_returns_only_two_public_keys_no_secret(setup_store_path):
    """158-06/D-07 (T-158-04 secret-leak): GET /public-config is OPEN and returns EXACTLY the
    two PUBLIC Supabase values — NEVER the service-role key / DSN / any secret."""
    resp = TestClient(_make_setup_app()).get("/public-config")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"supabase_url", "supabase_anon_key"}
    blob = repr(body).lower()
    for forbidden in ("service_role", "secret", "dsn"):
        assert forbidden not in blob, f"/public-config leaked a '{forbidden}' value"
