"""Phase 111.1 Plan 05 (EMBED-05) — settings kickoff change-detection unit tests.

`update_settings` must schedule the re-embed job (start_reembed) via background_tasks
ONLY when the embedding model OR dimensions actually change vs the previously-stored
values — a no-change save (or an unrelated settings change) must NOT re-embed.

These exercise the REAL `update_settings` handler with a fake BackgroundTasks +
monkeypatched load/save so the change-detection branch is proven without a live DB.
"""
from __future__ import annotations

import pytest

from app.api import settings as settings_api


class _FakeBG:
    """Captures background_tasks.add_task calls."""

    def __init__(self):
        self.tasks = []

    def add_task(self, func, *args, **kwargs):
        self.tasks.append((func, args, kwargs))


def _settings_obj(model: str, dims: int):
    """A minimal stand-in carrying just what the kickoff change-detection reads."""
    from app.models.user_settings import load_app_settings

    s = load_app_settings()
    # override only the embedding identity fields under test
    return s.model_copy(update={"embedding_model": model, "embedding_dimensions": dims})


async def _run_update(monkeypatch, body, prev, after):
    """Drive update_settings with monkeypatched load/save; return the captured BG tasks."""
    seq = {"loads": [prev, after, after]}  # prev snapshot, post-save new_settings, _build_response

    async def _fake_load():
        return seq["loads"].pop(0) if len(seq["loads"]) > 1 else after

    async def _fake_save(updates):
        return None

    async def _fake_build(s=None):
        return object()

    monkeypatch.setattr(settings_api, "load_app_settings_async", _fake_load)
    monkeypatch.setattr(settings_api, "save_app_settings", _fake_save)
    monkeypatch.setattr(settings_api, "_build_response", _fake_build)

    bg = _FakeBG()
    await settings_api.update_settings(
        body=body,
        background_tasks=bg,
        current_user={"id": "user-A"},
        supabase=object(),
    )
    return bg


def _kickoff_tasks(bg):
    return [t for t in bg.tasks if t[0] is settings_api.start_reembed]


@pytest.mark.asyncio
async def test_model_change_kicks_reembed(monkeypatch):
    """A changed embedding_model schedules start_reembed exactly once."""
    prev = _settings_obj("text-embedding-3-small", 1536)
    after = _settings_obj("text-embedding-3-large", 3072)
    body = settings_api.SettingsUpdate(embedding_model="text-embedding-3-large", embedding_dimensions=3072)

    bg = await _run_update(monkeypatch, body, prev, after)
    kicks = _kickoff_tasks(bg)
    assert len(kicks) == 1, "a model+dims change must schedule start_reembed once"
    # dims also changed here -> dims_changed True
    _, args, _ = kicks[0]
    assert args[1] == "user-A", "kickoff must scope to the calling user (RLS)"
    assert args[3] is True, "dims_changed must be True when dimensions change"


@pytest.mark.asyncio
async def test_dims_only_change_kicks_reembed(monkeypatch):
    """A dims-only change still kicks (and flags dims_changed=True)."""
    prev = _settings_obj("text-embedding-3-small", 1536)
    after = _settings_obj("text-embedding-3-small", 512)
    body = settings_api.SettingsUpdate(embedding_dimensions=512)

    bg = await _run_update(monkeypatch, body, prev, after)
    kicks = _kickoff_tasks(bg)
    assert len(kicks) == 1
    _, args, _ = kicks[0]
    assert args[3] is True, "dims_changed True on a dims-only change"


@pytest.mark.asyncio
async def test_model_only_change_kicks_without_resize(monkeypatch):
    """A model change at the SAME dims kicks but dims_changed=False (no destructive resize)."""
    prev = _settings_obj("text-embedding-3-small", 1536)
    after = _settings_obj("jina-embeddings-v3", 1536)
    body = settings_api.SettingsUpdate(embedding_model="jina-embeddings-v3")

    bg = await _run_update(monkeypatch, body, prev, after)
    kicks = _kickoff_tasks(bg)
    assert len(kicks) == 1
    _, args, _ = kicks[0]
    assert args[3] is False, "dims_changed False when only the model changes (no resize)"


@pytest.mark.asyncio
async def test_no_change_save_does_not_reembed(monkeypatch):
    """A save with the SAME embedding model + dims must NOT kick the job."""
    prev = _settings_obj("text-embedding-3-small", 1536)
    after = _settings_obj("text-embedding-3-small", 1536)
    body = settings_api.SettingsUpdate(retrieval_top_k=7)  # unrelated change

    bg = await _run_update(monkeypatch, body, prev, after)
    assert _kickoff_tasks(bg) == [], "a no-embedding-change save must NOT re-embed"
