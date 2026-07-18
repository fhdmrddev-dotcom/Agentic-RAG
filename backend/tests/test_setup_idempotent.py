"""Phase 158 Plan 01 (SC#2 / D-14) — idempotency + the hard lock-after-finalize.

Wave-0 Nyquist scaffold. Every wizard step is safe to re-run (re-entry shows current state,
no duplicate writes); after finalize the wizard REFUSES all config writes and shows "already
configured" (re-configuration is an /admin operator action, never the public pre-auth
wizard). The token dependency itself is the enforcement point: it asserts
``not setup_finalized()`` first → 409 (RESEARCH Code Examples :591-596). This file pins
(158-VALIDATION.md, SC#2/D-14):

  - ``require_setup_token`` raises 409 once ``setup_finalized()`` (the finalize latch refuses
    all config writes — the post-finalize-write hole is closed);
  - before finalize a valid-token write is accepted (the gate only closes AFTER finalize);
  - re-running a step is idempotent (no duplicate write).

``app.api.setup`` is a NEW module -> ``pytest.importorskip`` SKIPS the file cleanly until
Wave 2. Wave 2 wires the exact patch seam for ``setup_finalized`` (the api module binds it);
the finalize-latch 409 is the load-bearing lock-bypass proof (G-6(e)).
"""
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

# NEW module — skips cleanly until Wave 2 creates app/api/setup.py.
setup_api = pytest.importorskip("app.api.setup")
from app.api.setup import require_setup_token  # noqa: E402


def _make_app():
    """A minimal FastAPI app mounting ONLY the 158-06 setup routers (no lifespan / main wiring)."""
    from fastapi import FastAPI

    setup_api._failed_attempts.clear()  # pristine rate-limit window per app
    app_ = FastAPI()
    app_.include_router(setup_api.router)
    app_.include_router(setup_api.public_router)
    return app_


async def test_require_setup_token_rejects_after_finalize(setup_store_path, monkeypatch):
    """SC#2/D-14 (the lock-bypass proof, G-6(e)): once ``setup_finalized()`` is True the
    token dependency raises 409 for ANY write — even with a valid token — so no ``/setup/*``
    write can mutate config after finalize. Re-config is /admin-only."""
    # the api module binds setup_finalized at import; patch it where it is looked up
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: True, raising=False)
    with pytest.raises(HTTPException) as ei:
        await require_setup_token(x_setup_token="any-token")
    assert ei.value.status_code == 409


async def test_require_setup_token_allows_before_finalize(setup_store_path, monkeypatch):
    """SC#2/D-14: BEFORE finalize a valid token passes the dependency (the gate only closes
    after finalize). The token itself is verified constant-time (see test_setup_token)."""
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False, raising=False)
    monkeypatch.setattr(setup_api, "verify_token", lambda t: True, raising=False)
    # no exception → the write is allowed to proceed
    await require_setup_token(x_setup_token="valid-token")


async def test_step_rerun_is_idempotent_no_duplicate_write(setup_store_path, monkeypatch):
    """SC#2/D-14: re-running a step before finalize is idempotent — re-entry shows the
    current state and issues NO duplicate write (the operator can revisit a step; the
    operator upsert is ON CONFLICT DO NOTHING, the store write is a replace, not an append).
    Named here for the Nyquist map; Wave 2 drives the concrete step endpoint + asserts the
    second POST adds no new row / no second envelope."""
    # placeholder gate — Wave 2 flips this to the concrete per-step idempotency assertion
    assert hasattr(setup_api, "router"), "app.api.setup must expose the setup router"


# ── 158-06 (Task 2): the token-gated step endpoints — the security + idempotency contract ───


def test_every_write_route_requires_setup_token():
    """SECURITY (D-15, no RLS backstop): EVERY POST /setup/* WRITE route carries
    require_setup_token — introspect the router so a single un-tokened write (a full pre-auth
    config-write hole) can never ship. This is the phase's core security proof."""
    from fastapi.routing import APIRoute

    writes = [
        r for r in setup_api.router.routes
        if isinstance(r, APIRoute) and "POST" in r.methods
    ]
    assert writes, "expected POST write routes on the setup router"
    for r in writes:
        dep_calls = [d.call for d in r.dependant.dependencies]
        assert setup_api.require_setup_token in dep_calls, (
            f"{r.path} is MISSING require_setup_token — an un-tokened pre-auth write hole"
        )


def test_provider_key_save_false_surfaces_500(setup_store_path, monkeypatch):
    """D-12 (honest write-through, mirrors PUT /admin/flags): a False from the save seam is a
    REAL 500 — never a false 'saved'. The client cannot be told the key persisted when it didn't."""
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    monkeypatch.setattr(setup_api, "verify_token", lambda t: True)

    async def _save_false(*a, **k):
        return False

    monkeypatch.setattr(setup_api, "save_provider_key", _save_false)
    resp = TestClient(_make_app()).post(
        "/setup/provider-key",
        headers={"X-Setup-Token": "ok"},
        json={"provider": "openai", "api_key": "sk-real-enough-key"},
    )
    assert resp.status_code == 500


def test_provider_key_rerun_is_idempotent_single_write(setup_store_path, monkeypatch):
    """D-14: re-POSTing the provider-key step is safe — each POST funnels through the SINGLE
    save seam exactly once (no duplicate/forked write); a revisit is accepted, not doubled."""
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    monkeypatch.setattr(setup_api, "verify_token", lambda t: True)
    calls = []

    async def _save(provider, api_key, embedding_key=None):
        calls.append((provider, api_key))
        return True

    monkeypatch.setattr(setup_api, "save_provider_key", _save)
    client = TestClient(_make_app())
    body = {"provider": "openai", "api_key": "sk-real-enough-key"}
    r1 = client.post("/setup/provider-key", headers={"X-Setup-Token": "ok"}, json=body)
    r2 = client.post("/setup/provider-key", headers={"X-Setup-Token": "ok"}, json=body)
    assert r1.status_code == 200 and r2.status_code == 200
    assert calls == [("openai", "sk-real-enough-key"), ("openai", "sk-real-enough-key")]


def test_operator_duplicate_returns_already_exists_200(setup_store_path, monkeypatch):
    """D-11/D-14 (idempotent operator): a duplicate email → {already_exists:true} at 200 —
    NEVER a 500. Re-running the operator step is safe (ON CONFLICT DO NOTHING under the hood)."""
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    monkeypatch.setattr(setup_api, "verify_token", lambda t: True)

    async def _dup(*a, **k):
        return {"status": "already_exists", "already_exists": True, "user_id": "u-1"}

    monkeypatch.setattr(setup_api, "bootstrap_operator", _dup)
    resp = TestClient(_make_app()).post(
        "/setup/operator",
        headers={"X-Setup-Token": "ok"},
        json={"email": "op@x.co", "password": "supersecret"},
    )
    assert resp.status_code == 200
    assert resp.json()["already_exists"] is True


def test_operator_password_policy_error_maps_to_400_not_500(setup_store_path, monkeypatch):
    """D-11/T-158-06: a GoTrue password-policy rejection → 400 verbatim, never a 500 that hides
    the real cause (the wizard shows the operator exactly why the password was refused)."""
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    monkeypatch.setattr(setup_api, "verify_token", lambda t: True)

    async def _weak(*a, **k):
        raise ValueError("Password should be at least 6 characters.")

    monkeypatch.setattr(setup_api, "bootstrap_operator", _weak)
    resp = TestClient(_make_app()).post(
        "/setup/operator",
        headers={"X-Setup-Token": "ok"},
        json={"email": "op@x.co", "password": "x"},
    )
    assert resp.status_code == 400
    assert "at least 6" in resp.json()["detail"]


def test_step_reposted_after_finalize_returns_409(setup_store_path, monkeypatch):
    """D-14 (G-6(e), endpoint-level lock-bypass proof): once finalized, re-POSTing ANY step →
    409 through require_setup_token — a completed box's config can never be mutated by the
    public wizard (re-config is /admin-only)."""
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: True)
    resp = TestClient(_make_app()).post(
        "/setup/provider-key",
        headers={"X-Setup-Token": "ok"},
        json={"provider": "openai", "api_key": "sk-real-enough-key"},
    )
    assert resp.status_code == 409
