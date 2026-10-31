"""Phase 306-02 (GUARD-01; D-05, D-16, D-17, D-35) — admission leases and idempotency claims
against REAL Redis.

Requires Redis on ``REDIS_URL`` (default ``redis://localhost:6379``). It does NOT skip when Redis
is down: a skipped live suite is a suite that proved nothing, so an unreachable Redis FAILS here.
Every test uses fresh uuid ids and deletes every key it made in teardown.
"""
from __future__ import annotations

import asyncio
import hashlib
from types import SimpleNamespace
from uuid import uuid4

import pytest
import pytest_asyncio

from app.services import outside_admission as adm


@pytest_asyncio.fixture
async def live(redis_client, monkeypatch):
    assert await redis_client.ping() is True, "Redis must be up for the live admission suite"
    limits = SimpleNamespace(
        outside_inflight_per_org=4, outside_inflight_per_key=2, outside_inflight_per_provider=6,
    )

    async def _load():
        return limits

    monkeypatch.setattr(adm, "load_app_settings_async", _load)
    made: list[str] = []
    ids = SimpleNamespace(org=f"org-{uuid4()}", prov=f"prov-{uuid4()}", made=made, limits=limits)

    def cred() -> str:
        c = f"key-{uuid4()}"
        made.append("{adm}:cred:" + c)
        return c

    ids.cred = cred
    made.extend(["{adm}:org:" + ids.org, "{adm}:prov:" + ids.prov])
    yield redis_client, ids
    if made:
        await redis_client.delete(*made)


async def _acquire(redis, ids, cred, *, ttl=60, lease=None):
    return await adm.acquire(
        redis, org_id=ids.org, credential_id=cred, provider=ids.prov,
        lease_id=lease or str(uuid4()), ttl_s=ttl, retry_s=30,
    )


async def test_two_on_one_key_admit_and_the_third_is_full_credential(live):
    redis, ids = live
    c = ids.cred()
    assert isinstance(await _acquire(redis, ids, c), adm.Admitted)
    assert isinstance(await _acquire(redis, ids, c), adm.Admitted)
    assert await _acquire(redis, ids, c) == adm.Full(scope="credential", retry_s=30)
    assert await redis.zcard("{adm}:cred:" + c) == 2


async def test_five_across_three_keys_of_one_org_admit_four(live):
    redis, ids = live
    c1, c2, c3 = ids.cred(), ids.cred(), ids.cred()
    outcomes = [
        await _acquire(redis, ids, c) for c in (c1, c1, c2, c2, c3)
    ]
    assert [type(o).__name__ for o in outcomes[:4]] == ["Admitted"] * 4
    assert outcomes[4] == adm.Full(scope="org", retry_s=30)
    assert await redis.zcard("{adm}:org:" + ids.org) == 4


async def test_the_provider_scope_bites_across_orgs(live):
    redis, ids = live
    ids.limits.outside_inflight_per_provider = 1
    c = ids.cred()
    assert isinstance(await _acquire(redis, ids, c), adm.Admitted)
    other_org = f"org-{uuid4()}"
    ids.made.append("{adm}:org:" + other_org)
    out = await adm.acquire(redis, org_id=other_org, credential_id=ids.cred(),
                            provider=ids.prov, lease_id=str(uuid4()), ttl_s=60, retry_s=30)
    assert out == adm.Full(scope="provider", retry_s=30)


async def test_an_expired_lease_no_longer_counts(live):
    redis, ids = live
    c = ids.cred()
    assert isinstance(await _acquire(redis, ids, c, ttl=1), adm.Admitted)
    assert isinstance(await _acquire(redis, ids, c, ttl=1), adm.Admitted)
    assert isinstance(await _acquire(redis, ids, c, ttl=1), adm.Full)
    await asyncio.sleep(1.2)
    # No release: the per-member score expired, and the next acquire sweeps it.
    assert isinstance(await _acquire(redis, ids, c), adm.Admitted)


async def test_release_frees_the_slot_at_once(live):
    redis, ids = live
    c = ids.cred()
    first = await _acquire(redis, ids, c)
    await _acquire(redis, ids, c)
    assert isinstance(await _acquire(redis, ids, c), adm.Full)
    await adm.release(redis, org_id=ids.org, credential_id=c, provider=ids.prov,
                      lease_id=first.lease_id)
    for key in ("{adm}:org:" + ids.org, "{adm}:cred:" + c, "{adm}:prov:" + ids.prov):
        assert await redis.zscore(key, first.lease_id) is None
    assert isinstance(await _acquire(redis, ids, c), adm.Admitted)


async def test_twenty_concurrent_acquires_on_one_key_admit_exactly_two(live):
    redis, ids = live
    ids.limits.outside_inflight_per_org = 50
    ids.limits.outside_inflight_per_provider = 50
    c = ids.cred()
    outcomes = await asyncio.gather(*[_acquire(redis, ids, c) for _ in range(20)])
    assert sum(isinstance(o, adm.Admitted) for o in outcomes) == 2
    assert sum(o == adm.Full(scope="credential", retry_s=30) for o in outcomes) == 18


async def test_a_short_lease_never_shortens_the_key_life_of_a_long_one(live):
    # A run lease (1860 s) and an ask lease (900 s) share the org / credential / provider keys.
    # The key must outlive its longest member, or a running run silently stops counting.
    redis, ids = live
    c = ids.cred()
    await _acquire(redis, ids, c, ttl=1860)
    await _acquire(redis, ids, c, ttl=5)
    for key in ("{adm}:org:" + ids.org, "{adm}:cred:" + c, "{adm}:prov:" + ids.prov):
        assert await redis.ttl(key) > 1860


async def test_a_lease_is_scored_by_its_own_expiry(live):
    redis, ids = live
    c = ids.cred()
    out = await _acquire(redis, ids, c, ttl=900)
    import time  # noqa: PLC0415

    score = await redis.zscore("{adm}:cred:" + c, out.lease_id)
    assert 890 < score - time.time() <= 900


# ── idempotency claims, live ────────────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def idem(redis_client):
    assert await redis_client.ping() is True
    made: list[str] = []

    def key(cred: str, tool: str, client_key: str) -> str:
        k = adm.idem_redis_key(cred, tool, client_key)
        made.append(k)
        return k

    yield redis_client, key
    if made:
        await redis_client.delete(*made)


async def test_the_claim_lifecycle_against_real_redis(idem):
    redis, key = idem
    cred, other, client_key = f"k-{uuid4()}", f"k-{uuid4()}", f"idem-{uuid4()}"
    rk = key(cred, "ask_agent", client_key)
    key(other, "ask_agent", client_key)
    assert rk == "mcp:idem:" + cred + ":" + hashlib.sha256(
        f"ask_agent\0{client_key}".encode()).hexdigest()
    assert client_key not in rk

    kw = dict(credential_id=cred, tool="ask_agent", idempotency_key=client_key)
    assert await adm.claim(redis, request_sha="s1", **kw) == adm.Claimed()
    assert 86000 < await redis.ttl(rk) <= 86400
    assert await adm.claim(redis, request_sha="s1", **kw) == adm.Starting()
    await adm.bind(redis, run_id="r1", request_sha="s1", **kw)
    assert 86000 < await redis.ttl(rk) <= 86400
    assert await adm.claim(redis, request_sha="s1", **kw) == adm.Existing("r1", True)
    assert await adm.claim(redis, request_sha="s2", **kw) == adm.Existing("r1", False)
    assert await adm.claim(redis, credential_id=other, tool="ask_agent",
                           idempotency_key=client_key, request_sha="s1") == adm.Claimed()
    await adm.drop(redis, **kw)
    assert await adm.claim(redis, request_sha="s1", **kw) == adm.Claimed()


async def test_bind_without_a_claim_writes_nothing(idem):
    redis, key = idem
    cred, client_key = f"k-{uuid4()}", f"idem-{uuid4()}"
    rk = key(cred, "run_workflow", client_key)
    await adm.bind(redis, credential_id=cred, tool="run_workflow", idempotency_key=client_key,
                   run_id="r9", request_sha="s")
    assert await redis.get(rk) is None
