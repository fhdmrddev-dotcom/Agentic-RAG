"""Phase 306-02 (D-05; T-306-09, T-306-16, T-306-20) — idempotency claims, unit half.

A claim is ``SET NX EX 86400`` on ``mcp:idem:<credential id>:<sha256(tool + NUL + key)>``. The
client's string is never a Redis key and never reaches a log. Any Redis error refuses the start
(fail closed). The live half is in ``tests/integration/test_306_admission_redis_live.py``.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging

import pytest

from app.services import outside_admission as adm


class FakeRedis:
    """Enough of SET NX/XX EX, GET and DEL to drive the claim state machine."""

    def __init__(self, raises: Exception | None = None):
        self.store: dict[str, str] = {}
        self.ttl: dict[str, int] = {}
        self.raises = raises
        self.sets: list[dict] = []

    async def set(self, k, v, ex=None, nx=False, xx=False):
        if self.raises is not None:
            raise self.raises
        self.sets.append({"k": k, "v": v, "ex": ex, "nx": nx, "xx": xx})
        if nx and k in self.store:
            return None
        if xx and k not in self.store:
            return None
        self.store[k] = v
        self.ttl[k] = ex
        return True

    async def get(self, k):
        if self.raises is not None:
            raise self.raises
        return self.store.get(k)

    async def delete(self, *ks):
        if self.raises is not None:
            raise self.raises
        return sum(1 for k in ks if self.store.pop(k, None) is not None)


def _run(coro):
    return asyncio.run(coro)


def _claim(redis, *, cred="k1", key="abc", sha="s1", tool="ask_agent"):
    return _run(adm.claim(redis, credential_id=cred, tool=tool, idempotency_key=key,
                          request_sha=sha))


def _bind(redis, *, cred="k1", key="abc", sha="s1", run_id="r1", tool="ask_agent"):
    return _run(adm.bind(redis, credential_id=cred, tool=tool, idempotency_key=key,
                         run_id=run_id, request_sha=sha))


def test_the_redis_key_is_the_credential_and_a_hash_never_the_client_string():
    expected = "mcp:idem:k1:" + hashlib.sha256(b"ask_agent\0abc").hexdigest()
    got = adm.idem_redis_key("k1", "ask_agent", "abc")
    assert got == expected
    assert "abc" not in got


def test_the_tool_is_part_of_the_hash():
    assert adm.idem_redis_key("k1", "ask_agent", "x") != adm.idem_redis_key("k1", "run_workflow", "x")


def test_a_new_key_is_claimed_with_nx_and_a_day_ttl():
    redis = FakeRedis()
    assert _claim(redis) == adm.Claimed()
    s = redis.sets[0]
    assert (s["nx"], s["ex"]) == (True, 86400)
    assert json.loads(s["v"]) == {"state": "starting", "request_sha": "s1"}


def test_a_second_claim_before_bind_is_starting():
    redis = FakeRedis()
    _claim(redis)
    assert _claim(redis) == adm.Starting()


def test_after_bind_the_same_request_gets_the_existing_run():
    redis = FakeRedis()
    _claim(redis)
    _bind(redis)
    assert _claim(redis) == adm.Existing(run_id="r1", same_request=True)
    bound = redis.sets[-2]
    assert (bound["xx"], bound["ex"]) == (True, 86400)


def test_after_bind_a_different_request_gets_the_existing_run_flagged():
    redis = FakeRedis()
    _claim(redis)
    _bind(redis)
    assert _claim(redis, sha="s2") == adm.Existing(run_id="r1", same_request=False)


def test_another_credential_with_the_same_key_gets_its_own_claim():
    redis = FakeRedis()
    _claim(redis)
    _bind(redis)
    assert _claim(redis, cred="k2") == adm.Claimed()


def test_drop_frees_the_key():
    redis = FakeRedis()
    _claim(redis)
    _run(adm.drop(redis, credential_id="k1", tool="ask_agent", idempotency_key="abc"))
    assert _claim(redis) == adm.Claimed()


def test_drop_never_raises():
    _run(adm.drop(FakeRedis(raises=ConnectionError("down")), credential_id="k1",
                  tool="ask_agent", idempotency_key="abc"))


def test_a_redis_error_on_claim_refuses():
    with pytest.raises(adm.OutsideStartUnavailable):
        _claim(FakeRedis(raises=ConnectionError("down")))


def test_bind_never_raises_on_a_redis_error():
    _bind(FakeRedis(raises=ConnectionError("down")))


def test_no_log_carries_the_client_key(caplog):
    caplog.set_level(logging.DEBUG, logger=adm.logger.name)
    secret = "client-key-zz9-plural-z-alpha"
    with pytest.raises(adm.OutsideStartUnavailable):
        _claim(FakeRedis(raises=ConnectionError("down")), key=secret)
    _bind(FakeRedis(raises=ConnectionError("down")), key=secret)
    _run(adm.drop(FakeRedis(raises=ConnectionError("down")), credential_id="k1",
                  tool="ask_agent", idempotency_key=secret))
    assert caplog.records  # the failures were logged
    assert secret not in caplog.text
