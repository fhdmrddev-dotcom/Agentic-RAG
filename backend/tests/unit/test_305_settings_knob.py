"""Phase 305-03 (KEY-07; D-54) — the operator's searches-per-minute knob for AI tool keys.

``app_settings.api_key_searches_per_minute`` (migration 222, CHECK 1..120, default 30) limits the
EXPENSIVE per-key bucket (``search_knowledge_base``). Bounded in three places that agree: the
migration CHECK, the API 400 here, and the Settings UI clamp (``ApiKeyLimits.tsx``).
"""
from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.api.settings as settings_api
import app.models.user_settings as us
from app.models.user_settings import _build_settings_from_row

FIELD = "api_key_searches_per_minute"
LABEL = "Searches per minute, per key"


def test_the_default_is_30():
    assert us.UserEffectiveSettings.model_fields[FIELD].default == 30


def test_a_stored_value_reads_back():
    assert _build_settings_from_row({FIELD: 45}).api_key_searches_per_minute == 45


def test_a_row_without_the_column_reads_30():
    assert _build_settings_from_row({}).api_key_searches_per_minute == 30


async def test_the_response_and_the_update_body_carry_the_field():
    assert FIELD in settings_api.FullSettingsResponse.model_fields
    assert FIELD in settings_api.SettingsUpdate.model_fields
    assert FIELD in settings_api._BOUNDED_SETTINGS_FIELDS
    resp = await settings_api._build_response(_build_settings_from_row({FIELD: 12}))
    assert resp.api_key_searches_per_minute == 12


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
            current_user={"id": "u-305", "email": "t@example.com"},
            supabase=MagicMock(),
        )
    )


@pytest.mark.parametrize("bad", [0, 121])
def test_out_of_range_is_a_400_with_the_range_refusal(saved, bad, monkeypatch):
    calls: list[dict] = []
    real = settings_api._range_refusal_detail

    async def _spy(**kwargs):
        calls.append(kwargs)
        return await real(**kwargs)

    monkeypatch.setattr(settings_api, "_range_refusal_detail", _spy)
    with pytest.raises(HTTPException) as exc:
        _put(**{FIELD: bad})
    assert exc.value.status_code == 400
    assert LABEL in str(exc.value.detail)
    assert len(calls) == 1
    assert (calls[0]["field"], calls[0]["lo"], calls[0]["hi"], calls[0]["label"]) == (FIELD, 1, 120, LABEL)
    assert saved["calls"] == 0


@pytest.mark.parametrize("good", [1, 120])
def test_the_bounds_are_inclusive(saved, good):
    _put(**{FIELD: good})
    assert saved["updates"].get(FIELD) == good


def test_a_put_from_another_card_never_writes_it(saved):
    _put(vision_max_pages=40)
    assert FIELD not in saved["updates"]
