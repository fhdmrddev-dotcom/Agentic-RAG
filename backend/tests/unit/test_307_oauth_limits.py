"""Phase 307-02 (D-34, D-05; T-307-10) — four OAuth door buckets, each its own, each fail-closed.

``rate_limit.check_oauth_limit(redis, *, client, kind)`` counts one call from ``client`` on one of
``oauth_register`` / ``oauth_authorize`` / ``oauth_token`` / ``oauth_revoke``. Their keys never
share the MCP edge's ``mcp_ip`` bucket, so a burst on one door cannot starve ``/mcp`` or another
door. Door-wide ceilings (every caller behind the proxy shares an address — Pitfall 4 / SEED-397).
"""
from __future__ import annotations

import pytest

from app.services import rate_limit
from app.services.rate_limit import (
    OAUTH_AUTHORIZE_PER_MINUTE,
    OAUTH_REGISTER_PER_MINUTE,
    OAUTH_REVOKE_PER_MINUTE,
    OAUTH_TOKEN_PER_MINUTE,
    LimiterUnavailable,
    check_oauth_limit,
)


class _Pipe:
    def __init__(self, redis):
        self.redis = redis
        self.ops: list = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def incr(self, key):
        self.ops.append(("incr", key))

    def expire(self, key, seconds):
        self.ops.append(("expire", key, seconds))

    async def execute(self):
        if self.redis.broken:
            raise ConnectionError("redis down")
        out = []
        for op in self.ops:
            if op[0] == "incr":
                self.redis.counts[op[1]] = self.redis.counts.get(op[1], 0) + 1
                self.redis.keys.append(op[1])
                out.append(self.redis.counts[op[1]])
            else:
                out.append(True)
        return out


class _Redis:
    def __init__(self, broken=False):
        self.broken = broken
        self.counts: dict[str, int] = {}
        self.keys: list[str] = []

    def pipeline(self, transaction=True):
        assert transaction is True
        return _Pipe(self)


def test_the_four_ceilings():
    assert (OAUTH_REGISTER_PER_MINUTE, OAUTH_AUTHORIZE_PER_MINUTE, OAUTH_TOKEN_PER_MINUTE,
            OAUTH_REVOKE_PER_MINUTE) == (60, 120, 600, 120)


@pytest.mark.parametrize("kind, limit", [
    ("oauth_register", 60), ("oauth_authorize", 120), ("oauth_token", 600), ("oauth_revoke", 120),
])
async def test_under_the_limit_is_none_and_over_is_a_retry_after(kind, limit):
    redis = _Redis()
    for _ in range(limit):
        assert await check_oauth_limit(redis, client="1.2.3.4", kind=kind) is None
    retry = await check_oauth_limit(redis, client="1.2.3.4", kind=kind)
    assert isinstance(retry, int) and 1 <= retry <= 60


async def test_each_door_and_mcp_ip_have_distinct_keys():
    redis = _Redis()
    for kind in ("oauth_register", "oauth_authorize", "oauth_token", "oauth_revoke"):
        await check_oauth_limit(redis, client="1.2.3.4", kind=kind)
    await rate_limit.check_ip_limit(redis, client="1.2.3.4")
    prefixes = {k.rsplit(":", 1)[0] for k in redis.keys}
    assert prefixes == {
        "apikey:rl:oauth_register:1.2.3.4",
        "apikey:rl:oauth_authorize:1.2.3.4",
        "apikey:rl:oauth_token:1.2.3.4",
        "apikey:rl:oauth_revoke:1.2.3.4",
        "apikey:rl:mcp_ip:1.2.3.4",
    }


async def test_a_full_door_does_not_starve_another_door_or_mcp():
    redis = _Redis()
    for _ in range(OAUTH_REGISTER_PER_MINUTE + 5):
        await check_oauth_limit(redis, client="9.9.9.9", kind="oauth_register")
    assert await check_oauth_limit(redis, client="9.9.9.9", kind="oauth_token") is None
    assert await rate_limit.check_ip_limit(redis, client="9.9.9.9") is None


async def test_redis_down_fails_closed():
    with pytest.raises(LimiterUnavailable):
        await check_oauth_limit(_Redis(broken=True), client="1.2.3.4", kind="oauth_token")


async def test_an_unknown_kind_is_refused_not_admitted():
    with pytest.raises(ValueError):
        await check_oauth_limit(_Redis(), client="1.2.3.4", kind="mcp_ip")  # type: ignore[arg-type]
