"""Phase 296-01 — SEED-365 (rate-limit half) / D-13: citation checks are limited per user.

``POST /citation-checks/{message_id}`` runs a paid engine call each time. Before 296 the only
guard was the per-message in-flight claim (one check at a time per message), so one user could
re-check message after message as fast as they could click. The limit:

  * ``CITATION_CHECKS_PER_MINUTE`` (10) per user per minute, on the same Redis fixed-window
    counter the API keys use (``rate_limit.hit``), so it holds across both uvicorn workers;
  * over the limit → 429, ``detail == {"reason": "rate_limited"}`` (the route's dict-refusal
    shape; the sentence lives client-side in 296-04) and a ``Retry-After`` of 1..60 seconds;
  * Redis down → 503 ``{"reason": "unavailable"}`` — FAIL CLOSED, never admitted uncounted;
  * it runs BEFORE the in-flight claim, so a limited call never sets the ``nx`` key.

The router is mounted on a FRESH ``FastAPI()`` (never ``app.main.app``'s lifespan — SEED-363).
"""

from __future__ import annotations

import pytest

from app import dependencies as deps
from app.api import citation_checks as route
from app.services import rate_limit
from tests.unit.phase293_inbound_fakes import FakePipeline
from tests.unit.test_294_citation_check_route import (  # noqa: F401 — `env` is a fixture
    MSG_ID,
    USER_ID,
    _engine_ok,
    env,
)

OTHER_USER = "66666666-6666-4666-8666-666666666666"


class _CountingRedis:
    """The in-flight claim (``set nx`` + release ``eval``) AND the limiter's INCR pipeline."""

    def __init__(self):
        self.store: dict[str, str] = {}
        self.kv: dict[str, str] = {}
        self.nx_sets: list[str] = []

    async def set(self, key, value, nx=False, ex=None):
        self.nx_sets.append(key)
        if nx and key in self.kv:
            return None
        self.kv[key] = value
        return True

    async def eval(self, _script, _n, key, value):
        if self.kv.get(key) == value:
            del self.kv[key]
            return 1
        return 0

    def pipeline(self, transaction=True):
        return FakePipeline(self)


class _BrokenRedis(_CountingRedis):
    def pipeline(self, transaction=True):
        raise ConnectionError("redis is down")


def test_the_limit_is_a_module_constant_of_ten():
    assert rate_limit.CITATION_CHECKS_PER_MINUTE == 10


def test_the_eleventh_check_in_a_minute_is_refused(env, monkeypatch):
    _engine_ok(monkeypatch)
    env.redis = _CountingRedis()
    env.app.dependency_overrides[deps.get_redis] = lambda: env.redis
    for i in range(rate_limit.CITATION_CHECKS_PER_MINUTE):
        r = env.client.post(f"/citation-checks/{MSG_ID}")
        assert r.status_code == 200, (i, r.status_code, r.text)
    claims_before = len(env.redis.nx_sets)
    r = env.client.post(f"/citation-checks/{MSG_ID}")
    assert r.status_code == 429
    assert r.json()["detail"] == {"reason": "rate_limited"}
    assert 1 <= int(r.headers["Retry-After"]) <= 60
    # the limiter ran BEFORE the in-flight claim: a limited call never touched the nx key
    assert len(env.redis.nx_sets) == claims_before


def test_another_user_is_not_affected(env, monkeypatch):
    _engine_ok(monkeypatch)
    env.redis = _CountingRedis()
    env.app.dependency_overrides[deps.get_redis] = lambda: env.redis
    for _ in range(rate_limit.CITATION_CHECKS_PER_MINUTE):
        assert env.client.post(f"/citation-checks/{MSG_ID}").status_code == 200
    assert env.client.post(f"/citation-checks/{MSG_ID}").status_code == 429
    env.app.dependency_overrides[deps.get_current_user] = lambda: {"id": OTHER_USER, "email": "v@example.com"}
    assert env.client.post(f"/citation-checks/{MSG_ID}").status_code == 200


def test_a_redis_failure_refuses_with_503_never_admits(env, monkeypatch):
    rec = _engine_ok(monkeypatch)
    env.redis = _BrokenRedis()
    env.app.dependency_overrides[deps.get_redis] = lambda: env.redis
    r = env.client.post(f"/citation-checks/{MSG_ID}")
    assert r.status_code == 503
    assert r.json()["detail"] == {"reason": "unavailable"}
    assert env.redis.nx_sets == [], "an uncounted call must never reach the in-flight claim"
    assert rec.requests == [], "a refused call must never reach the paid engine"


@pytest.mark.asyncio
async def test_enforce_user_citation_limit_counts_per_user():
    redis = _CountingRedis()
    for _ in range(rate_limit.CITATION_CHECKS_PER_MINUTE):
        await rate_limit.enforce_user_citation_limit(redis, user_id=USER_ID)
    with pytest.raises(Exception) as exc:
        await rate_limit.enforce_user_citation_limit(redis, user_id=USER_ID)
    assert getattr(exc.value, "status_code", None) == 429
    assert any(k.startswith("apikey:rl:citation:" + USER_ID) for k in redis.store)
    await rate_limit.enforce_user_citation_limit(redis, user_id=OTHER_USER)


def test_route_calls_the_limiter_before_the_claim():
    import inspect

    src = inspect.getsource(route.post_citation_check)
    assert src.index("enforce_user_citation_limit") < src.index("nx=True")
