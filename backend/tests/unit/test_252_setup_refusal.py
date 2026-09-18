"""Phase 252 Plan 01 Task 3 (W-4 / D-31) — a REFUSED provider-key write answers 400.

``POST /setup/provider-key`` is the ONE ``save_app_settings`` seam of six that had no
``except SettingsWriteRefused`` arm. Phase 249 gave the other five one (``settings.py:951``,
``admin.py`` twice, and the finalize site whose comment it corrected rather than deleted);
this one was missed, and the refusal it would meet is precisely the *knob shipped without its
migration* signature the exception exists to name — a setup wizard is the first thing to run
against a database whose migrations may not all be applied.

TWO cases, and the second is the CONTROL:

  1. ``save_provider_key`` raises ``SettingsWriteRefused`` -> **400**, detail naming the
     refused COLUMN and the constraint. Before the fix this propagated uncaught.
  2. ``save_provider_key`` returns ``False`` -> **500**, with the existing message, byte for
     byte. This must pass BEFORE and AFTER: it is what proves the fix did not widen. The two
     mean different things — a refusal is a caller error, a ``False`` is an honest
     write-through failure (``user_settings.py:51-69``).

⛔ No real secret anywhere: the "key" is an obvious throwaway, and one assertion exists purely
to prove the 400 body does NOT echo it (TM-252-05).
"""
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.models.user_settings import SettingsWriteRefused

# An obviously-fake value. TM-252-05 asserts this string never reaches the response body.
THROWAWAY_KEY = "sk-THROWAWAY-NOT-A-REAL-KEY-252"


def _make_app(monkeypatch):
    """Mount the real setup router with the token gate satisfied the way the shipped setup
    tests do it (``test_setup_token.py:90-102``): a FastAPI app carrying the real router, with
    the per-process finalize latch forced False so a sibling test cannot leak a 409 in."""
    import app.api.setup as setup_api

    setup_api._failed_attempts.clear()
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False)
    app_ = FastAPI()
    app_.include_router(setup_api.router)
    app_.include_router(setup_api.public_router)
    return app_


def _post(client, token):
    return client.post(
        "/setup/provider-key",
        headers={"X-Setup-Token": token},
        json={"provider": "openai", "api_key": THROWAWAY_KEY},
    )


@pytest.fixture
def setup_client(setup_store_path, monkeypatch):
    """A token-gated client for ``/setup/provider-key``. Yields ``(client, token)``."""
    from app.services.setup_store import get_or_create_token

    app_ = _make_app(monkeypatch)
    yield TestClient(app_), get_or_create_token()


def test_provider_key_refusal_answers_400(setup_client, monkeypatch):
    """W-4: a DATABASE REFUSAL is a caller error — 400, naming the column and the rule.

    ``SettingsWriteRefused`` is constructed with its REAL signature
    (``__init__(columns: list[str], constraint: str | None)``, ``user_settings.py:72``), the
    same shape ``save_app_settings`` raises at ``:707``.
    """
    import app.api.setup as setup_api

    async def _refuse(*_a, **_k):
        raise SettingsWriteRefused(["openai_api_key"], "app_settings_openai_api_key_check")

    monkeypatch.setattr(setup_api, "save_provider_key", _refuse)

    client, token = setup_client
    resp = _post(client, token)

    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert "openai_api_key" in detail, detail
    assert "app_settings_openai_api_key_check" in detail, detail
    # TM-252-05 — the detail is built from column + constraint names. Never the value.
    assert THROWAWAY_KEY not in resp.text


def test_provider_key_write_through_failure_still_answers_500(setup_client, monkeypatch):
    """CONTROL — unchanged. A ``False`` return is an honest write-through failure and keeps
    its existing 500 and its existing message, byte for byte. If this test ever goes red the
    fix widened past its remit."""
    import app.api.setup as setup_api

    async def _fail(*_a, **_k):
        return False

    monkeypatch.setattr(setup_api, "save_provider_key", _fail)

    client, token = setup_client
    resp = _post(client, token)

    assert resp.status_code == 500, resp.text
    assert resp.json()["detail"] == "Could not persist the provider key — it was not saved."
