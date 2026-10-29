"""Phase 300-05 (D-07, D-08, D-10; T-300-37, T-300-38, T-300-39) — the mail knobs in Settings.

The operator sets four things: the delay before a run-waiting email (bounded 60..3600, migration
218's CHECK agrees), the sender address, the sender name and the test address used outside
production. Which provider sends is INFRA (``EMAIL_PROVIDER`` and its secret live in the
environment, D-08), so ``GET /settings`` reports its NAME and a PUT can never write it.

⛔ No secret crosses this route: ``RESEND_API_KEY`` and every ``SMTP_*`` value stay in the env.
⛔ Header injection: a sender name or address carrying CR/LF or another control character is
refused with a sentence (the mailer's ``one_line`` is the second wall, 300-03).
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.api.settings as settings_api
from app.models.user_settings import _build_settings_from_row

_SETTINGS_PY = Path(settings_api.__file__)
_BAD_ADDRESS = "That isn't an email address."
_DELAY = "notification_email_delay_seconds"
_DELAY_LABEL = "Wait before emailing (seconds)"


@pytest.fixture
def saved(monkeypatch) -> dict:
    captured: dict = {"calls": 0, "updates": {}}

    async def _columns_exist() -> bool:
        return True

    async def _save(updates):
        captured["calls"] += 1
        captured["updates"].update(updates)
        return True

    async def _load():
        return _build_settings_from_row({})

    async def _response(*_a, **_kw):
        return "response-not-under-test"

    monkeypatch.setattr(settings_api, "app_settings_has_hnsw_columns", _columns_exist)
    monkeypatch.setattr(settings_api, "save_app_settings", _save)
    monkeypatch.setattr(settings_api, "load_app_settings_async", _load)
    monkeypatch.setattr(settings_api, "_build_response", _response)
    return captured


def _put(**kwargs):
    return asyncio.run(
        settings_api.update_settings(
            body=settings_api.SettingsUpdate(**kwargs),
            background_tasks=MagicMock(),
            current_user={"id": "u-300", "email": "t@example.com"},
            supabase=MagicMock(),
        )
    )


# ── GET /settings ───────────────────────────────────────────────────────────────────────────


def test_the_response_carries_the_four_knobs_and_the_provider_name(monkeypatch):
    for name in (
        _DELAY,
        "email_from_address",
        "email_from_name",
        "email_dev_redirect_address",
        "email_provider",
    ):
        assert name in settings_api.FullSettingsResponse.model_fields, name
    monkeypatch.setattr(settings_api, "configured_provider", lambda: "smtp")
    resp = asyncio.run(settings_api._build_response(_build_settings_from_row({})))
    assert resp.notification_email_delay_seconds == 120
    assert resp.email_from_address == ""
    assert resp.email_from_name == "Syrel"
    assert resp.email_dev_redirect_address == ""
    assert resp.email_provider == "smtp"


def test_stored_values_read_back(monkeypatch):
    monkeypatch.setattr(settings_api, "configured_provider", lambda: "resend")
    row = {
        _DELAY: 600,
        "email_from_address": "notify@notify.example.com",
        "email_from_name": "Syrel Alerts",
        "email_dev_redirect_address": "me@example.com",
    }
    resp = asyncio.run(settings_api._build_response(_build_settings_from_row(row)))
    assert (
        resp.notification_email_delay_seconds,
        resp.email_from_address,
        resp.email_from_name,
        resp.email_dev_redirect_address,
        resp.email_provider,
    ) == (600, "notify@notify.example.com", "Syrel Alerts", "me@example.com", "resend")


def test_no_mail_secret_is_a_response_field():
    fields = " ".join(settings_api.FullSettingsResponse.model_fields).lower()
    for secret in ("resend_api_key", "smtp_password", "smtp_username", "smtp_host", "smtp_port"):
        assert secret not in fields
    source = _SETTINGS_PY.read_text(encoding="utf-8").lower()
    assert "resend_api_key" not in source
    assert "smtp_password" not in source


def test_the_provider_is_never_writable():
    assert "email_provider" not in settings_api.SettingsUpdate.model_fields


def test_a_put_naming_the_provider_writes_nothing_for_it(saved):
    settings_api.SettingsUpdate.model_validate({"email_provider": "smtp"})  # extra key ignored
    asyncio.run(
        settings_api.update_settings(
            body=settings_api.SettingsUpdate.model_validate({"email_provider": "smtp"}),
            background_tasks=MagicMock(),
            current_user={"id": "u-300", "email": "t@example.com"},
            supabase=MagicMock(),
        )
    )
    assert "email_provider" not in saved["updates"]


# ── the delay (D-07) ────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("bad", [59, 3601, 0])
def test_the_delay_is_refused_out_of_range(saved, bad):
    with pytest.raises(HTTPException) as exc:
        _put(**{_DELAY: bad})
    assert exc.value.status_code == 400
    detail = str(exc.value.detail)
    assert _DELAY_LABEL in detail
    assert "60" in detail and "3600" in detail
    assert saved["calls"] == 0


def test_the_delay_refusal_routes_through_the_shared_helper(monkeypatch, saved):
    calls: list[dict] = []
    real = settings_api._range_refusal_detail

    async def _spy(**kwargs):
        calls.append(kwargs)
        return await real(**kwargs)

    monkeypatch.setattr(settings_api, "_range_refusal_detail", _spy)
    with pytest.raises(HTTPException):
        _put(**{_DELAY: 59})
    assert len(calls) == 1
    assert calls[0]["field"] == _DELAY
    assert (calls[0]["lo"], calls[0]["hi"]) == (60, 3600)
    assert calls[0]["label"] == _DELAY_LABEL
    assert _DELAY in settings_api._BOUNDED_SETTINGS_FIELDS


@pytest.mark.parametrize("good", [60, 3600, 120])
def test_the_delay_bounds_are_inclusive(saved, good):
    _put(**{_DELAY: good})
    assert saved["updates"][_DELAY] == good


# ── the two addresses (D-08, D-10) ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("field", ["email_from_address", "email_dev_redirect_address"])
def test_an_empty_address_clears_it(saved, field):
    """Empty means "use the environment's address" (from) / "hold mail back" (test). Every reader
    treats an empty value exactly as NULL (``getattr(...) or fallback``)."""
    _put(**{field: ""})
    assert saved["updates"][field] == ""


@pytest.mark.parametrize("field", ["email_from_address", "email_dev_redirect_address"])
def test_one_address_is_stored(saved, field):
    _put(**{field: "notify@notify.example.com"})
    assert saved["updates"][field] == "notify@notify.example.com"


@pytest.mark.parametrize("field", ["email_from_address", "email_dev_redirect_address"])
@pytest.mark.parametrize(
    "bad",
    [
        "two words@x.y",
        "a@b",
        "x\r\n@y.z",
        "notify@example.com\n",
        "a@x.y, b@x.y",
        "Name <a@x.y>",
        "no-at-sign.example.com",
        "a@b@c.d",
    ],
)
def test_anything_but_one_address_is_refused(saved, field, bad):
    with pytest.raises(HTTPException) as exc:
        _put(**{field: bad})
    assert exc.value.status_code == 400
    assert exc.value.detail == _BAD_ADDRESS
    assert saved["calls"] == 0


# ── the sender name (D-08) ──────────────────────────────────────────────────────────────────


def test_a_sender_name_is_stored_as_typed(saved):
    _put(email_from_name="Syrel Alerts")
    assert saved["updates"]["email_from_name"] == "Syrel Alerts"


@pytest.mark.parametrize("bad", ["", "x" * 61, "Syrel\r\nBcc: a@b.c", "Syrel\tAlerts", "Syrel\x00"])
def test_a_bad_sender_name_is_refused_with_its_label(saved, bad):
    with pytest.raises(HTTPException) as exc:
        _put(email_from_name=bad)
    assert exc.value.status_code == 400
    assert "Send from (name)" in str(exc.value.detail)
    assert saved["calls"] == 0


def test_a_sixty_character_name_is_accepted(saved):
    _put(email_from_name="x" * 60)
    assert saved["updates"]["email_from_name"] == "x" * 60
