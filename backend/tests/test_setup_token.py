"""Phase 158 Plan 01 (D-15) — first-boot setup token: 401 gate + constant-time verify.

Wave-0 Nyquist scaffold. The setup token is the pre-auth anti-hijack credential (the
n8n/Jupyter idiom): minted once on first unfinalized boot, printed to backend stdout
(``docker compose logs backend``), required + constant-time-verified on every ``/setup/*``
write. This file pins the ``setup_store`` token primitives (158-VALIDATION.md, SC#2/D-15):

  - a missing token is rejected (``verify_token(None)`` is False);
  - a wrong token is rejected;
  - the correct persisted token verifies True;
  - ``verify_token`` uses ``hmac.compare_digest`` (constant-time — anti-brute-force);
  - ``get_or_create_token`` persists (stable across calls — the operator reads it once).

``app.services.setup_store`` is a NEW module -> ``pytest.importorskip`` SKIPS the file
cleanly until Wave 1 lands it. All token values are throwaway (generated per test into the
``setup_store_path`` tmp store — never a real token; T-158-scaffold).
"""
import inspect

# app/services/setup_store.py landed in Wave 1 (Plan 158-03) — direct import (the module
# now exists, so the 158-01 importorskip guard is retired).
from app.services.setup_store import get_or_create_token, verify_token


def test_verify_token_rejects_missing(setup_store_path):
    """D-15: a MISSING ``X-Setup-Token`` is rejected — ``verify_token(None)`` is False
    (the api dependency turns this into a 401)."""
    assert verify_token(None) is False


def test_verify_token_rejects_wrong(setup_store_path):
    """D-15: a WRONG token is rejected even though a real token exists in the store."""
    get_or_create_token()  # mint the real one into the throwaway store
    assert verify_token("definitely-not-the-real-token") is False


def test_verify_token_accepts_correct(setup_store_path):
    """D-15: the correct persisted token verifies True (the api dependency lets the write
    through)."""
    tok = get_or_create_token()
    assert verify_token(tok) is True


def test_verify_token_uses_constant_time_compare(setup_store_path):
    """D-15: ``verify_token`` compares with ``hmac.compare_digest`` (constant-time) so the
    token cannot be recovered by a timing side-channel (T-158 brute-force)."""
    src = inspect.getsource(verify_token)
    assert "compare_digest" in src, "verify_token must use hmac.compare_digest (constant-time)"


def test_get_or_create_token_is_stable(setup_store_path):
    """D-15: the token PERSISTS in the 0600 store — a second call returns the SAME value
    (re-printed each unfinalized boot so it stays discoverable; the finalize lock is the
    real boundary, not token rotation)."""
    assert get_or_create_token() == get_or_create_token()


def test_get_or_create_token_returns_persisted_race_winner(setup_store_path, monkeypatch):
    """WR-02 (WORKER_COUNT=2): if a sibling worker's mint clobbers ours between our write and
    our re-read, ``get_or_create_token`` returns the PERSISTED (winner's) token — so the value
    we announce is the one ``verify_token`` accepts, not a stale local candidate that 401s.
    Before the fix it returned the locally-minted candidate regardless of the persisted value."""
    import app.services.setup_store as store_mod

    sibling_token = "SIBLING-WINNER-TOKEN"
    real_write = store_mod.write_store

    def _racing_write(data):
        real_write(data)  # persist OUR candidate (as the real code does)...
        s = store_mod.read_store()  # ...then a sibling worker's write lands + clobbers.
        s["setup_token"] = sibling_token
        real_write(s)

    monkeypatch.setattr(store_mod, "write_store", _racing_write)
    returned = store_mod.get_or_create_token()
    assert returned == sibling_token, "must return the persisted race-winner, not the local candidate"
    assert store_mod.read_store()["setup_token"] == sibling_token


# ── 158-06 (Task 1): require_setup_token over a REAL ASGI request (TestClient) ──────────────
# The write gate is the SOLE pre-auth access authority (no RLS backstop, D-15). A tiny
# token-gated probe route stands in for the write endpoints (which land in 158-06 Task 2), so
# the dependency's 401 / pass / 409 behavior is proven over a genuine request at the skeleton
# stage. Every "should reach the gate" test patches setup_finalized -> False so the per-process
# finalize latch (a monotonic module global another test may have tripped) can never leak in.
from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def _make_token_app():
    """Mount the setup routers + a throwaway token-gated probe so require_setup_token runs over
    a real request. Clears the in-process rate-limit window so each app starts pristine."""
    import app.api.setup as setup_api

    setup_api._failed_attempts.clear()
    app_ = FastAPI()
    app_.include_router(setup_api.router)
    app_.include_router(setup_api.public_router)

    @app_.post("/setup/_probe", dependencies=[Depends(setup_api.require_setup_token)])
    async def _probe():  # pragma: no cover - trivial gated stand-in
        return {"ok": True}

    return app_


def test_write_gate_rejects_missing_token(setup_store_path, monkeypatch):
    """158-06/D-15 (T-158-01 hijack): a WRITE with NO X-Setup-Token → 401 (the pre-auth wall)."""
    import app.api.setup as setup_api

    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    resp = TestClient(_make_token_app()).post("/setup/_probe")
    assert resp.status_code == 401


def test_write_gate_rejects_wrong_token(setup_store_path, monkeypatch):
    """158-06/D-15: a WRITE with a WRONG token → 401 even though a real token exists."""
    import app.api.setup as setup_api

    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    get_or_create_token()  # mint the real token into the throwaway store
    resp = TestClient(_make_token_app()).post(
        "/setup/_probe", headers={"X-Setup-Token": "not-the-real-token"}
    )
    assert resp.status_code == 401


def test_write_gate_accepts_correct_token(setup_store_path, monkeypatch):
    """158-06/D-15: the CORRECT persisted token passes the gate — the write proceeds (200)."""
    import app.api.setup as setup_api

    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    tok = get_or_create_token()
    resp = TestClient(_make_token_app()).post("/setup/_probe", headers={"X-Setup-Token": tok})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_write_gate_409_after_finalize(setup_store_path, monkeypatch):
    """158-06/D-14 (G-6(e) lock-bypass proof): once finalized, EVERY write → 409 even with a
    valid token — the finalize latch is checked BEFORE the token, and re-config is /admin-only."""
    import app.api.setup as setup_api

    monkeypatch.setattr(setup_api, "setup_finalized", lambda: True)
    resp = TestClient(_make_token_app()).post(
        "/setup/_probe", headers={"X-Setup-Token": "any-token-at-all"}
    )
    assert resp.status_code == 409
