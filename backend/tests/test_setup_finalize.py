"""Phase 158 Plan 01 (SC#2 / D-05) — finalize writes BOTH markers; setup_finalized latches.

Wave-0 Nyquist scaffold. The finalize marker is dual (D-05): the LOCAL file marker
(``/data/setup.json`` ``finalized:true``) is the blip-proof GATE AUTHORITY (read cheaply,
immune to a transient DB outage — a DB blip must NEVER bounce a live box's users into the
wizard), and the DB ``app_settings.setup_complete`` boolean is the AUDITABLE/app-facing
signal. Finalize writes BOTH. This file pins the ``setup_store`` file-marker latch behavior
(158-VALIDATION.md, SC#2/D-05):

  - a fresh box (no marker) → ``setup_finalized()`` is False (setup needed);
  - after ``finalized:true`` is written → ``setup_finalized()`` returns True;
  - the latch is MONOTONIC / sticky-True — once True it STAYS True even if the marker file
    is later cleared (a box never un-finalizes via the wizard; the byte-identical hot path
    never re-reads the file);
  - finalize ALSO writes the auditable DB signal via the ``setup_complete()`` read side.

``app.services.setup_store`` is a NEW module -> ``pytest.importorskip`` SKIPS the file
cleanly until Wave 1. The store is the throwaway ``setup_store_path`` tmp file.
"""
# app/services/setup_store.py landed in Wave 1 (Plan 158-03) — direct import (the module
# now exists, so the 158-01 importorskip guard is retired).
from fastapi.testclient import TestClient

from app.services.setup_store import read_store, setup_finalized, write_store


def _make_app():
    """Minimal app mounting the 158-06 setup routers (no lifespan / main.py wiring)."""
    from fastapi import FastAPI

    import app.api.setup as setup_api

    setup_api._failed_attempts.clear()
    app_ = FastAPI()
    app_.include_router(setup_api.router)
    app_.include_router(setup_api.public_router)
    return app_


_FINALIZE_BODY = {
    "supabase_url": "https://real-project.supabase.co",
    "supabase_anon_key": "anon-public-key",
    "supabase_service_role_key": "svc-role-secret",
    "postgres_dsn": "postgresql://u:p@h:5432/db",
    "redis_url": "redis://h:6379",
    "operator_emails": "op@x.co",
    "provider": "openai",
    "provider_key": "sk-real-enough",
}


def test_setup_finalized_false_on_fresh_store(setup_store_path):
    """D-05: a fresh box (no marker file) → ``setup_finalized()`` is False → setup is
    needed. The gate authority defaults to 'not configured' when the marker is absent."""
    assert setup_finalized() is False


def test_finalize_marker_latches_true(setup_store_path):
    """D-05: writing ``finalized:true`` to the store → ``setup_finalized()`` returns True.
    The file marker (not the DB flag) is the blip-proof gate authority."""
    write_store({"finalized": True})
    assert setup_finalized() is True


def test_setup_finalized_is_sticky_true(setup_store_path):
    """D-05 (the monotonic latch): once finalized, ``setup_finalized()`` stays True even if
    the marker is later cleared — a box never un-finalizes via the wizard, and the
    byte-identical hot path never re-reads the file (RESEARCH Pattern 4)."""
    write_store({"finalized": True})
    assert setup_finalized() is True
    write_store({})  # clear the marker on disk
    assert setup_finalized() is True, "the finalized latch must be sticky-True (monotonic)"


def test_finalize_also_writes_auditable_db_flag(setup_store_path):
    """D-05: finalize writes BOTH markers — the auditable DB half is
    ``app_settings.setup_complete``, read via the ``user_settings.setup_complete()`` helper
    (beside ``maintenance_mode()``). Named here for the Nyquist map; the write path is
    exercised in the api/finalize wave. Honest RED via getattr until the helper lands."""
    import app.models.user_settings as us
    setup_complete = getattr(us, "setup_complete", None)
    assert setup_complete is not None and callable(setup_complete), (
        "RED until Wave 1/2: user_settings.setup_complete() (the auditable DB signal, "
        "default False on cold cache / DB blip — mirrors maintenance_mode())"
    )


# ── 158-06 (Task 3): POST /setup/finalize — the server-side smoke gate + dual marker ────────


def test_finalize_refuses_when_smoke_not_all_green(setup_store_path, monkeypatch):
    """D-13 (the gate cannot be forced): finalize RE-RUNS the smoke server-side and REFUSES
    (409) when any row is red — a client cannot force finalize by claiming 'all green'. NEITHER
    marker is written; save_app_settings is never called."""
    import app.api.setup as setup_api

    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    monkeypatch.setattr(setup_api, "verify_token", lambda t: True)

    async def _not_green(cfg=None):
        return {"checks": {"redis_ping": {"state": "down", "reason": "down"}}, "all_green": False}

    monkeypatch.setattr(setup_api, "run_smoke_checks", _not_green)
    saved = []

    async def _save(updates):
        saved.append(updates)
        return True

    monkeypatch.setattr(setup_api, "save_app_settings", _save)

    resp = TestClient(_make_app()).post(
        "/setup/finalize", headers={"X-Setup-Token": "ok"}, json=_FINALIZE_BODY
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "smoke_not_green"
    assert read_store().get("finalized") is not True  # no file marker written
    assert saved == []  # no DB flag written


def test_finalize_writes_both_markers_and_locks_out(setup_store_path, monkeypatch):
    """D-05 (dual marker) + D-14 (lock-out): on an all-green smoke, finalize writes BOTH the
    FILE marker (setup_store.finalize) AND the auditable DB flag (save_app_settings), returns
    restart_required, and every subsequent write is 409'd by the finalize latch."""
    import app.api.setup as setup_api
    import app.services.setup_store as store_mod

    # pristine monotonic latch — a prior test's sticky-True must not leak in
    monkeypatch.setattr(store_mod, "_finalized_latch", False)
    monkeypatch.setattr(setup_api, "verify_token", lambda t: True)

    async def _all_green(cfg=None):
        return {"checks": {"supabase_auth": {"state": "up"}}, "all_green": True}

    monkeypatch.setattr(setup_api, "run_smoke_checks", _all_green)
    saved = []

    async def _save(updates):
        saved.append(updates)
        return True

    monkeypatch.setattr(setup_api, "save_app_settings", _save)

    client = TestClient(_make_app())
    resp = client.post("/setup/finalize", headers={"X-Setup-Token": "ok"}, json=_FINALIZE_BODY)
    assert resp.status_code == 200
    data = resp.json()
    assert data["finalized"] is True
    assert data["restart_required"] is True

    # marker 1 — the FILE marker (the blip-proof gate authority)
    assert read_store().get("finalized") is True
    # marker 2 — the auditable DB flag through the save seam
    assert {"setup_complete": True} in saved

    # lock-out: any further write is now 409'd (re-config is /admin-only)
    resp2 = client.post(
        "/setup/operator",
        headers={"X-Setup-Token": "ok"},
        json={"email": "op@x.co", "password": "supersecret"},
    )
    assert resp2.status_code == 409
