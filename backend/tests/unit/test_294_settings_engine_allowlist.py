"""Phase 294-04 (DEC-01, SC#6 browser half) — the rerank engine allowlist on PUT /settings.

``rerank_provider`` is a free-text field that selects which vendor receives candidate passages,
so an unknown id must be refused at the boundary (T-294-21) rather than stored and silently
treated as Cohere downstream. The accepted set is imported from
``app.services.rerank_engines.registry.ACCEPTED_PROVIDER_IDS`` — never a retyped list here either,
so a new engine is accepted by adding its registry row.

And GET /settings must never carry a key (T-294-22): Jev reads the stored OpenRouter key and
OpenAI Decisions the stored OpenAI key (D-02), so planting values in those columns and in
``rerank_api_key`` must leave the JSON body free of every planted value.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.services.rerank_engines.registry import ACCEPTED_PROVIDER_IDS
from tests.unit.test_settings import _fake_settings


def _wire(monkeypatch, sm, captured: dict, calls: list):
    async def _fake_save(updates):
        calls.append("save")
        captured.update(updates)
        return True

    async def _fake_load():
        return _fake_settings()

    async def _fake_build(s=None):
        return MagicMock()

    monkeypatch.setattr(sm, "save_app_settings", _fake_save)
    monkeypatch.setattr(sm, "load_app_settings_async", _fake_load)
    monkeypatch.setattr(sm, "_build_response", _fake_build)


async def _put(sm, **fields):
    return await sm.update_settings(
        body=sm.SettingsUpdate(**fields),
        background_tasks=BackgroundTasks(),
        current_user={"id": "u1"},
        supabase=MagicMock(),
    )


def test_accepted_ids_cover_every_engine_and_the_legacy_alias():
    # Non-vacuity for the parametrisation below: the registry really carries the five ids.
    assert set(ACCEPTED_PROVIDER_IDS) == {"api", "cohere", "local", "jev", "openai_decisions"}


@pytest.mark.parametrize("engine_id", ["jev", "openai_decisions", "local", "cohere", "api"])
async def test_put_accepts_every_known_engine(monkeypatch, engine_id):
    import app.api.settings as sm

    captured: dict = {}
    calls: list = []
    _wire(monkeypatch, sm, captured, calls)

    await _put(sm, rerank_provider=engine_id)

    assert calls == ["save"]
    assert captured["rerank_provider"] == engine_id


@pytest.mark.parametrize("bad", ["evil", "", "Jev", "openai", "cohere "])
async def test_put_refuses_an_unknown_engine_and_writes_nothing(monkeypatch, bad):
    import app.api.settings as sm

    captured: dict = {}
    calls: list = []
    _wire(monkeypatch, sm, captured, calls)

    with pytest.raises(HTTPException) as exc:
        await _put(sm, rerank_provider=bad, rerank_enabled=True)

    assert exc.value.status_code == 400
    assert calls == [], "save_app_settings must not be reached for an unknown engine id"
    detail = str(exc.value.detail)
    # Plain language, naming every engine the operator can pick.
    for words in ("On this server", "Jev via OpenRouter", "OpenAI Decisions", "Cohere"):
        assert words in detail


async def test_put_without_rerank_provider_is_unaffected(monkeypatch):
    import app.api.settings as sm

    captured: dict = {}
    calls: list = []
    _wire(monkeypatch, sm, captured, calls)

    await _put(sm, rerank_enabled=True)

    assert calls == ["save"]
    assert "rerank_provider" not in captured


def _provider(pid: str, key: str):
    return SimpleNamespace(
        id=pid, name=pid.title(), base_url=f"https://{pid}.example/v1", api_key=key,
        is_active=False, models=[],
    )


async def test_get_settings_body_never_carries_a_key(monkeypatch):
    import app.api.settings as sm

    planted = {
        "openrouter": "sk-or-v1-PLANTED-294-openrouter-ABCDEF",
        "openai": "sk-proj-PLANTED-294-openai-GHIJKL",
        "rerank": "co-PLANTED-294-cohere-MNOPQR",
    }
    s = _fake_settings(
        providers=[_provider("openrouter", planted["openrouter"]), _provider("openai", planted["openai"])],
        rerank_enabled=True,
        rerank_provider="jev",
        rerank_api_key=planted["rerank"],
    )

    resp = await sm._build_response(s)
    body = json.dumps(resp.model_dump(mode="json"))

    for value in planted.values():
        assert value not in body
        # Not even a recognisable fragment of the planted secret.
        assert "PLANTED-294" not in body

    assert resp.rerank_has_api_key is True
    by_id = {p.id: p for p in resp.providers}
    assert by_id["openrouter"].has_key is True
    assert by_id["openai"].has_key is True
    assert all(isinstance(p.has_key, bool) for p in resp.providers)
    assert isinstance(resp.rerank_has_api_key, bool)
    # Non-vacuity: the response really did carry the providers we planted keys in.
    assert set(by_id) == {"openrouter", "openai"}
