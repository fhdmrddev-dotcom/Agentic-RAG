"""Phase 150 Plan 04 Task 1 (SEC-01 / D-150-07 / SC#2) — failed-save surfaces HTTP 500.

``update_settings`` used to fire-and-forget ``save_app_settings``' bool (settings.py:453),
so a swallowed DB write (pool blip / connection reset / UndefinedColumn on an unmigrated
secret column) returned a false HTTP 200 PLUS a false ``settings.update`` audit row PLUS a
spurious re-embed kick. This suite proves the round-trip surfacing:

  1. test_failed_save_returns_500          — a False save -> HTTPException(500,
                                              "Failed to save settings").
  2. test_failed_save_skips_audit_and_reembed — the raise short-circuits BEFORE the audit
                                              write and the re-embed kick (no background
                                              task scheduled).
  3. test_successful_save_still_200        — a True save still reaches the normal response
                                              (no regression).

Mocking mirrors ``test_147_flag_failure_semantics``: we do NOT spin a TestClient — the
handler coroutine is called directly with stubbed deps, and the module-level
``save_app_settings`` / ``load_app_settings_async`` / ``_build_response`` seams the handler
calls are monkeypatched. ``BackgroundTasks`` is real so we can inspect ``.tasks`` (nothing
runs — the handler only *schedules* onto it).
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import BackgroundTasks, HTTPException

import app.api.settings as settings_api
from app.api.settings import SettingsUpdate, update_settings


def _prev_settings_stub():
    """The embedding model/dims snapshot update_settings reads at :449-451 BEFORE the save
    (and again after, to detect a change). Same object both reads => no re-embed kick."""
    return SimpleNamespace(
        embedding_model="text-embedding-3-small",
        embedding_dimensions=1536,
    )


@pytest.mark.asyncio
async def test_failed_save_returns_500(monkeypatch):
    """save_app_settings returns False -> HTTP 500 with the D-150-07 detail."""
    monkeypatch.setattr(
        settings_api, "load_app_settings_async", AsyncMock(return_value=_prev_settings_stub())
    )
    monkeypatch.setattr(settings_api, "save_app_settings", AsyncMock(return_value=False))

    body = SettingsUpdate(llm_model="gpt-5.4")
    bg = BackgroundTasks()

    with pytest.raises(HTTPException) as exc:
        await update_settings(body, bg, current_user={"id": "op-1"}, supabase=MagicMock())

    assert exc.value.status_code == 500
    assert exc.value.detail == "Failed to save settings"


@pytest.mark.asyncio
async def test_failed_save_skips_audit_and_reembed(monkeypatch):
    """On a failed save the raise sits BEFORE background_tasks.add_task(write_audit_entry ...)
    and the re-embed kick, so NOTHING is scheduled — no false audit row, no spurious job."""
    monkeypatch.setattr(
        settings_api, "load_app_settings_async", AsyncMock(return_value=_prev_settings_stub())
    )
    monkeypatch.setattr(settings_api, "save_app_settings", AsyncMock(return_value=False))
    # If the raise did NOT short-circuit, these would be scheduled onto bg.tasks.
    monkeypatch.setattr(settings_api, "write_audit_entry", MagicMock())
    monkeypatch.setattr(settings_api, "start_reembed", MagicMock())

    body = SettingsUpdate(llm_model="gpt-5.4")
    bg = BackgroundTasks()

    with pytest.raises(HTTPException):
        await update_settings(body, bg, current_user={"id": "op-1"}, supabase=MagicMock())

    assert bg.tasks == [], "a failed save must schedule neither the audit write nor the re-embed"


@pytest.mark.asyncio
async def test_successful_save_still_200(monkeypatch):
    """A successful save is unaffected: the handler reaches _build_response and returns it,
    after scheduling exactly the settings.update audit (no re-embed on an unchanged model)."""
    prev = _prev_settings_stub()
    monkeypatch.setattr(settings_api, "load_app_settings_async", AsyncMock(return_value=prev))
    monkeypatch.setattr(settings_api, "save_app_settings", AsyncMock(return_value=True))
    sentinel = object()
    monkeypatch.setattr(settings_api, "_build_response", AsyncMock(return_value=sentinel))

    body = SettingsUpdate(llm_model="gpt-5.4")
    bg = BackgroundTasks()

    result = await update_settings(body, bg, current_user={"id": "op-1"}, supabase=MagicMock())

    assert result is sentinel, "successful save must return the normal _build_response payload"
    # Flow continued past the save: the settings.update audit was scheduled. Embedding model
    # + dims are unchanged (same stub both reads), so NO re-embed task is added -> exactly one.
    assert len(bg.tasks) == 1, "successful save should schedule exactly the audit task"
