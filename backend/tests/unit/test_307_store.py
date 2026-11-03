"""Phase 307-02 (D-45; T-307-02) — pending authorize requests and codes in Redis.

* ``oauth:req:{uuid4}`` — 600 s; peeked (never consumed) by the consent page, TAKEN by approve/deny.
* ``oauth:code:{sha256(code)}`` — 60 s; TAKEN once at ``/oauth/token``. A take writes
  ``oauth:codeused:{sha256}`` (600 s, the grant id) so a replay is recognised and kills the grant.
* ``oauth:cimdfail:{sha256(client_id)}`` — 60 s negative cache for an unreadable CIMD document.

Every take is ONE MULTI GET+DEL — never ``oauth_state.take_pending_state``'s two round trips (P-2).
A plaintext code never appears in a key or a value. A Redis failure is ``OAuthStoreUnavailable``.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re

import pytest

from app.mcp import oauth_store as s
from tests.unit._oauth307_fakes import FakeRedis

UUID4 = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")


async def test_save_request_is_a_setex_600_under_a_lowercase_uuid4():
    r = FakeRedis()
    rid = await s.save_request(r, {"status": "ready", "state": "abc"})
    assert UUID4.fullmatch(rid)
    assert r.ttls[f"oauth:req:{rid}"] == 600
    assert json.loads(r.store[f"oauth:req:{rid}"]) == {"status": "ready", "state": "abc"}


async def test_peek_does_not_consume_and_take_does():
    r = FakeRedis()
    rid = await s.save_request(r, {"status": "ready"})
    assert await s.peek_request(r, rid) == {"status": "ready"}
    assert await s.peek_request(r, rid) == {"status": "ready"}
    assert await s.take_request(r, rid) == {"status": "ready"}
    assert await s.take_request(r, rid) is None
    assert await s.peek_request(r, rid) is None
    assert r.pipelines[-1] == {"transaction": True, "ops": ["get", "delete"]}


async def test_two_concurrent_takes_get_exactly_one_value():
    r = FakeRedis()
    rid = await s.save_request(r, {"status": "ready"})
    results = await asyncio.gather(*(s.take_request(r, rid) for _ in range(5)))
    assert sum(1 for x in results if x is not None) == 1


@pytest.mark.parametrize("rid", [
    "not-a-uuid", "", "ABCDEFAB-1234-4123-8123-123456789012", "../x",
    "12345678-1234-1234-1234-123456789012",  # not version 4
    None,
])
async def test_a_malformed_request_id_never_reaches_redis(rid):
    r = FakeRedis()
    assert await s.peek_request(r, rid) is None
    assert await s.take_request(r, rid) is None
    assert r.calls == [] and r.pipelines == []


async def test_save_refused_request_keeps_reason_and_host_only():
    r = FakeRedis()
    rid = await s.save_refused_request(r, reason="host_not_allowed", host="evil.example")
    assert await s.peek_request(r, rid) == {
        "status": "refused", "reason": "host_not_allowed", "host": "evil.example"
    }


async def test_a_code_is_keyed_by_its_digest_and_taken_once():
    r = FakeRedis()
    code = "the-plaintext-code-value"
    digest = s.digest_code(code)
    assert digest == hashlib.sha256(code.encode()).hexdigest()
    await s.save_code(r, code_digest=digest, record={"grant_id": "g-1", "client_id": "c"})
    assert r.ttls[f"oauth:code:{digest}"] == 60
    assert all(code not in k and code not in str(v) for k, v in r.store.items())
    assert await s.code_was_used(r, digest) is None
    assert await s.take_code(r, digest) == {"grant_id": "g-1", "client_id": "c"}
    assert r.ttls[f"oauth:codeused:{digest}"] == 600
    assert await s.take_code(r, digest) is None
    assert await s.code_was_used(r, digest) == "g-1"
    assert r.pipelines[-1]["transaction"] is True


async def test_concurrent_code_takes_get_exactly_one_value():
    r = FakeRedis()
    digest = s.digest_code("c0de")
    await s.save_code(r, code_digest=digest, record={"grant_id": "g"})
    results = await asyncio.gather(*(s.take_code(r, digest) for _ in range(5)))
    assert sum(1 for x in results if x is not None) == 1


async def test_cimd_negative_cache():
    r = FakeRedis()
    url = "https://example.com/meta"
    assert await s.cimd_failed(r, url) is False
    await s.mark_cimd_failed(r, url)
    key = f"oauth:cimdfail:{hashlib.sha256(url.encode()).hexdigest()}"
    assert r.ttls[key] == 60
    assert await s.cimd_failed(r, url) is True


@pytest.mark.parametrize("call", [
    lambda r: s.save_request(r, {"status": "ready"}),
    lambda r: s.save_refused_request(r, reason="unknown_client", host=None),
    lambda r: s.peek_request(r, "6f1c2e0a-7d3b-4c8e-9a1f-2b3c4d5e6f70"),
    lambda r: s.take_request(r, "6f1c2e0a-7d3b-4c8e-9a1f-2b3c4d5e6f70"),
    lambda r: s.save_code(r, code_digest="ab" * 32, record={"grant_id": "g"}),
    lambda r: s.take_code(r, "ab" * 32),
    lambda r: s.code_was_used(r, "ab" * 32),
    lambda r: s.cimd_failed(r, "https://example.com/m"),
    lambda r: s.mark_cimd_failed(r, "https://example.com/m"),
])
async def test_redis_down_is_oauth_store_unavailable(call):
    with pytest.raises(s.OAuthStoreUnavailable):
        await call(FakeRedis(broken=True))


def test_the_store_never_reuses_the_non_atomic_oauth_state_take():
    import inspect

    src = inspect.getsource(s)
    assert "take_pending_state" not in src
    assert "pipeline(transaction=True)" in src
