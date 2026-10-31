"""Phase 306-02 (D-04 / D-36 / D-35) — the four outside-start knobs, end to end on the backend.

``app_settings.mcp_ask_wait_seconds`` (5..45, default 30) and ``outside_inflight_per_key`` /
``_per_org`` / ``_per_provider`` (1..50, defaults 2 / 4 / 6), migration 223. Bounded in three
places that agree: the migration CHECK, the API 400 here, and the Settings UI clamp
(``ApiKeyLimits.tsx``). Structure copied from ``test_305_settings_knob.py``.
"""
from __future__ import annotations

import asyncio
import re
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.api.settings as settings_api
import app.models.user_settings as us
from app.models.user_settings import _build_settings_from_row

# field -> (default, lo, hi, UI-SPEC label)
KNOBS = {
    "mcp_ask_wait_seconds": (30, 5, 45, "Answer wait, in seconds"),
    "outside_inflight_per_key": (2, 1, 50, "Running at once, per key"),
    "outside_inflight_per_org": (4, 1, 50, "Running at once, per organisation"),
    "outside_inflight_per_provider": (6, 1, 50, "Running at once, per AI provider"),
}
_MIG = Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "223_mcp_ask_run_and_admission.sql"


@pytest.mark.parametrize("field", KNOBS)
def test_the_default(field):
    assert us.UserEffectiveSettings.model_fields[field].default == KNOBS[field][0]


@pytest.mark.parametrize("field", KNOBS)
def test_a_stored_value_reads_back(field):
    assert getattr(_build_settings_from_row({field: 7}), field) == 7


@pytest.mark.parametrize("field", KNOBS)
def test_a_row_without_the_column_reads_the_default(field):
    assert getattr(_build_settings_from_row({}), field) == KNOBS[field][0]


@pytest.mark.parametrize("field", KNOBS)
async def test_the_response_and_the_update_body_carry_the_field(field):
    assert field in settings_api.FullSettingsResponse.model_fields
    assert field in settings_api.SettingsUpdate.model_fields
    assert field in settings_api._BOUNDED_SETTINGS_FIELDS
    resp = await settings_api._build_response(_build_settings_from_row({field: 9}))
    assert getattr(resp, field) == 9


@pytest.mark.parametrize("field", KNOBS)
def test_the_api_bounds_agree_with_the_migration_check(field):
    _default, lo, hi, _label = KNOBS[field]
    sql = _MIG.read_text(encoding="utf-8")
    assert re.search(rf"CHECK \({field} >= {lo} AND {field} <= {hi}\)", sql), field
    assert re.search(rf"ADD COLUMN IF NOT EXISTS {field} integer NOT NULL DEFAULT {_default};", sql)


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
            current_user={"id": "u-306", "email": "t@example.com"},
            supabase=MagicMock(),
        )
    )


_OUT = [(f, KNOBS[f][1] - 1) for f in KNOBS] + [(f, KNOBS[f][2] + 1) for f in KNOBS]
_IN = [(f, KNOBS[f][1]) for f in KNOBS] + [(f, KNOBS[f][2]) for f in KNOBS]


@pytest.mark.parametrize("field,bad", _OUT)
def test_out_of_range_is_a_400_with_the_range_refusal(saved, field, bad, monkeypatch):
    _default, lo, hi, label = KNOBS[field]
    calls: list[dict] = []
    real = settings_api._range_refusal_detail

    async def _spy(**kwargs):
        calls.append(kwargs)
        return await real(**kwargs)

    monkeypatch.setattr(settings_api, "_range_refusal_detail", _spy)
    with pytest.raises(HTTPException) as exc:
        _put(**{field: bad})
    assert exc.value.status_code == 400
    assert label in str(exc.value.detail)
    assert len(calls) == 1
    assert (calls[0]["field"], calls[0]["lo"], calls[0]["hi"], calls[0]["label"]) == (
        field, lo, hi, label)
    assert saved["calls"] == 0


@pytest.mark.parametrize("field,good", _IN)
def test_the_bounds_are_inclusive(saved, field, good):
    _put(**{field: good})
    assert saved["updates"].get(field) == good


def test_a_put_from_another_card_never_writes_them(saved):
    _put(vision_max_pages=40)
    assert not set(KNOBS) & set(saved["updates"])
