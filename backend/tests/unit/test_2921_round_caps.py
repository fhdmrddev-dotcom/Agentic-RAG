"""Phase 292.1 (BUG-261024-03, D-17 / D-18 / D-19) — the two tool-round caps are SETTINGS.

The chat agent stops after `chat_max_tool_rounds` tool rounds per turn (default 15) and the
explorer after `explorer_max_tool_rounds` (default 8), then shows the limit line + Continue. Until
this phase both were constants, so the cross-provider UAT board could only reach the cap by
running 15 real tool rounds per row. Now they are operator settings in `app_settings`, bounded
2..50 in three places that must agree: the migration 214 CHECK, the `PUT /settings` 400 (through
`_range_refusal_detail`, allow-listed), and the Settings UI input clamp.

⚠ EVERY CASE HERE RUNS WITHOUT A DATABASE. The defaults case (`_build_settings_from_row({})`) is
the proof that a database WITHOUT migration 214 — cloud, until the operator pastes it — still reads
15 / 8. That is the `_val` fallback, and it is the whole reason the column can ship ahead of the
cloud apply on the read side.

⛔ This file deliberately does NOT import plan 01's `resolve_round_cap`: plan 02 and plan 01 share
no file and run in parallel, so a cross-plan import here would make this suite's verdict depend on
merge order.
"""

from __future__ import annotations

import asyncio
import inspect
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.api.settings as settings_api
import app.models.user_settings as us
from app.models.user_settings import _build_settings_from_row

FIELDS = ("chat_max_tool_rounds", "explorer_max_tool_rounds")
DEFAULTS = {"chat_max_tool_rounds": 15, "explorer_max_tool_rounds": 8}
LABELS = {
    "chat_max_tool_rounds": "Tool rounds per chat turn",
    "explorer_max_tool_rounds": "Tool rounds per explorer turn",
}


# ── Test 1 + Test 5 — defaults and the no-migration fallback (D-17) ─────────────────────────────


def test_an_empty_row_reads_15_and_8():
    """A database without migration 214 has no such keys in the row: the effective settings must
    still read 15 / 8, or the cap changes the moment the backend deploys ahead of the migration."""
    s = _build_settings_from_row({})
    assert s.chat_max_tool_rounds == 15
    assert s.explorer_max_tool_rounds == 8


def test_a_stored_value_wins_over_the_fallback():
    s = _build_settings_from_row({"chat_max_tool_rounds": 4, "explorer_max_tool_rounds": 3})
    assert s.chat_max_tool_rounds == 4
    assert s.explorer_max_tool_rounds == 3


def test_the_model_field_defaults_are_exactly_15_and_8():
    fields = us.UserEffectiveSettings.model_fields
    for name, default in DEFAULTS.items():
        assert name in fields, f"UserEffectiveSettings has no {name} field"
        assert fields[name].default == default


def test_this_suite_does_not_depend_on_plan_01():
    """Test 5 — no cross-plan import. Plan 01's resolver reads these fields; this plan only
    provides them."""
    import sys

    src = inspect.getsource(sys.modules[__name__])
    forbidden = "import " + "resolve_round_cap"
    assert forbidden not in src


# ── Test 4 — the GET response exposes both fields ──────────────────────────────────────────────


def test_the_response_model_exposes_both_fields():
    for name in FIELDS:
        assert name in settings_api.FullSettingsResponse.model_fields, (
            f"GET /settings does not serve {name}, so the Settings UI cannot show its value"
        )
        assert name in settings_api.SettingsUpdate.model_fields, (
            f"PUT /settings does not accept {name}"
        )


async def test_the_built_response_carries_the_stored_values():
    resp = await settings_api._build_response(
        _build_settings_from_row({"chat_max_tool_rounds": 6, "explorer_max_tool_rounds": 5})
    )
    assert resp.chat_max_tool_rounds == 6
    assert resp.explorer_max_tool_rounds == 5


# ── Test 2 + Test 3 — the PUT boundary (D-18) ──────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _no_database(monkeypatch):
    """`update_settings` probes for the HNSW columns unconditionally; stub it TRUE so these cases
    test the round-cap bound and not whether migration 176 was pasted."""

    async def _columns_exist() -> bool:
        return True

    monkeypatch.setattr(settings_api, "app_settings_has_hnsw_columns", _columns_exist)


@pytest.fixture
def saved(monkeypatch) -> dict:
    """Make `update_settings` writable without a database and hand back what it wrote.

    "Did not raise" is only half of accepted; the other half is that the value reached the write.
    """
    captured: dict = {"calls": 0, "updates": {}}

    async def _save(updates):
        captured["calls"] += 1
        captured["updates"].update(updates)
        return True

    async def _load():
        return _build_settings_from_row({})

    async def _response(*_a, **_kw):
        return "response-not-under-test"

    monkeypatch.setattr(settings_api, "save_app_settings", _save)
    monkeypatch.setattr(settings_api, "load_app_settings_async", _load)
    monkeypatch.setattr(settings_api, "_build_response", _response)
    return captured


def _put(**kwargs):
    return asyncio.run(
        settings_api.update_settings(
            body=settings_api.SettingsUpdate(**kwargs),
            background_tasks=MagicMock(),
            current_user={"id": "u-2921", "email": "t@example.com"},
            supabase=MagicMock(),
        )
    )


@pytest.mark.parametrize("field", FIELDS)
@pytest.mark.parametrize("bad", [1, 51, 0, -3, 10_000])
def test_the_put_refuses_a_cap_outside_2_to_50(saved, field, bad):
    with pytest.raises(HTTPException) as exc:
        _put(**{field: bad})
    assert exc.value.status_code == 400
    detail = str(exc.value.detail)
    assert LABELS[field] in detail
    assert "2" in detail and "50" in detail
    # Nothing is written for a refused value.
    assert saved["calls"] == 0
    assert field not in saved["updates"]


@pytest.mark.parametrize("field", FIELDS)
def test_the_refusal_states_what_the_bound_buys(saved, field):
    """SEED-258's binding property for this file: the refusal states the COST, not merely the
    range."""
    with pytest.raises(HTTPException) as exc:
        _put(**{field: 51})
    detail = str(exc.value.detail).lower()
    assert "between 2 and 50" in detail
    assert "very long time" in detail or "no tool could ever run" in detail


@pytest.mark.parametrize("field", FIELDS)
def test_the_refusal_routes_through_the_shared_helper(monkeypatch, saved, field):
    """D-18 — the 400 detail is produced by `_range_refusal_detail`, so a value that was ALREADY
    stored out of range is named as such rather than read as a rejection of a fresh edit."""
    calls: list[dict] = []
    real = settings_api._range_refusal_detail

    async def _spy(**kwargs):
        calls.append(kwargs)
        return await real(**kwargs)

    monkeypatch.setattr(settings_api, "_range_refusal_detail", _spy)
    with pytest.raises(HTTPException):
        _put(**{field: 1})
    assert len(calls) == 1
    assert calls[0]["field"] == field
    assert (calls[0]["lo"], calls[0]["hi"]) == (2, 50)
    assert calls[0]["label"] == LABELS[field]


def test_both_fields_are_on_the_refusal_allow_list():
    for name in FIELDS:
        assert name in settings_api._BOUNDED_SETTINGS_FIELDS


@pytest.mark.parametrize("field", FIELDS)
@pytest.mark.parametrize("good", [2, 50, 15, 8])
def test_the_put_accepts_the_bounds_inclusive(saved, field, good):
    _put(**{field: good})
    assert saved["updates"].get(field) == good


def test_a_put_omitting_both_writes_neither(saved):
    """Changed-fields only: a save from another card must not write the round caps."""
    _put(vision_max_pages=40)
    for name in FIELDS:
        assert name not in saved["updates"]
    assert saved["updates"].get("vision_max_pages") == 40
