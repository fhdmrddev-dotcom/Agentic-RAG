"""BUG-261015-06: a shutting-down process interrupted EVERY paused ask_user in Redis.

``broadcast_shutdown_sentinel_to_all`` SCANned ``ask_user:channels:*`` across the whole Redis, so
the backend unit suite (``test_health``'s ``TestClient(app)`` runs the real lifespan on the live
local Redis) interrupted all 7 live re-drive pauses on the dev server, and one uvicorn worker
restarting would interrupt the OTHER worker's pauses. The sentinel now goes only to the channels
this process is itself waiting on.
"""
from __future__ import annotations

import json
from pathlib import Path

import app.services.ask_user_service as svc

_BACKEND = Path(__file__).resolve().parents[2]


class _FakeRedis:
    def __init__(self, advertised: dict[str, set[str]]):
        self.advertised = advertised
        self.published: list[tuple[str, dict]] = []

    async def scan_iter(self, pattern, count=100):
        for k in self.advertised:
            yield k

    async def smembers(self, key):
        return self.advertised.get(key, set())

    async def publish(self, ch, payload):
        self.published.append((ch, json.loads(payload)))
        return 1


async def test_only_this_process_channels_get_the_sentinel(monkeypatch):
    monkeypatch.setattr(svc, "_LOCAL_CHANNELS", set())
    mine, theirs = "ask_user:run-a:tc-1", "ask_user:run-b:tc-2"
    svc.register_local_channel(mine)
    redis = _FakeRedis({"ask_user:channels:run-a": {mine}, "ask_user:channels:run-b": {theirs}})
    await svc.broadcast_shutdown_sentinel_to_all(redis)
    assert redis.published == [(mine, {"kind": "shutdown"})]


async def test_an_unregistered_channel_is_not_signalled(monkeypatch):
    monkeypatch.setattr(svc, "_LOCAL_CHANNELS", set())
    ch = "ask_user:run-a:tc-1"
    svc.register_local_channel(ch)
    svc.unregister_local_channel(ch)
    redis = _FakeRedis({"ask_user:channels:run-a": {ch}})
    await svc.broadcast_shutdown_sentinel_to_all(redis)
    assert redis.published == []


def test_both_subscribe_sites_register_and_unregister():
    for rel in ("app/services/ask_user_service.py", "app/services/tools/agent_control.py"):
        src = (_BACKEND / rel).read_text(encoding="utf-8")
        assert src.count("register_local_channel(channel)") >= 1, rel
        assert src.count("unregister_local_channel(channel)") >= 1, rel
