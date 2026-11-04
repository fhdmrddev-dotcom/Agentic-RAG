"""Phase 306-02 (GUARD-01; D-16, D-17, D-35) — the outside-start admission leases, unit half.

``outside_admission.acquire`` runs ONE Lua script over three Redis sorted sets (org, credential,
provider). These tests drive it against a fake whose ``eval`` returns scripted lists, so the
mapping from the script's answer to ``Admitted`` / ``Full`` is pinned without a Redis. The live
suite (``tests/integration/test_306_admission_redis_live.py``) drives the script itself.
"""
from __future__ import annotations

import ast
import asyncio
import re
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import outside_admission as adm

_SRC = Path(adm.__file__).read_text(encoding="utf-8")


class FakeRedis:
    """``eval`` answers from a script of results (or raises); ``zrem`` records."""

    def __init__(self, answer=(0,), raises: Exception | None = None, zrem_raises=False):
        self.answer = list(answer)
        self.raises = raises
        self.zrem_raises = zrem_raises
        self.evals: list[tuple] = []
        self.zrems: list[tuple] = []

    async def eval(self, script, numkeys, *args):
        self.evals.append((script, numkeys, *args))
        if self.raises is not None:
            raise self.raises
        return self.answer

    async def zrem(self, key, *members):
        self.zrems.append((key, *members))
        if self.zrem_raises:
            raise ConnectionError("redis gone")
        return 1


@pytest.fixture(autouse=True)
def limits(monkeypatch):
    values = SimpleNamespace(
        outside_inflight_per_org=4, outside_inflight_per_key=2, outside_inflight_per_provider=6,
    )

    async def _load():
        return values

    monkeypatch.setattr(adm, "load_app_settings_async", _load)
    return values


def _acquire(redis, **kw):
    args = dict(org_id="org-1", credential_id="key-1", provider="openai", lease_id="lease-1",
                ttl_s=1860, retry_s=30)
    args.update(kw)
    return asyncio.run(adm.acquire(redis, **args))


def test_zero_admits_with_the_lease_id():
    out = _acquire(FakeRedis([0]))
    assert out == adm.Admitted(lease_id="lease-1")


@pytest.mark.parametrize("answer,scope", [(1, "org"), (2, "credential"), (3, "provider")])
def test_a_full_scope_is_named_with_the_retry(answer, scope):
    out = _acquire(FakeRedis([answer]), retry_s=15)
    assert out == adm.Full(scope=scope, retry_s=15)


def test_the_script_gets_three_hash_tagged_keys_and_the_limits_in_argv():
    redis = FakeRedis([0])
    _acquire(redis)
    script, numkeys, *rest = redis.evals[0]
    assert script == adm._ACQUIRE
    assert numkeys == 3
    k_org, k_cred, k_prov, now, ttl, lease, lim_org, lim_cred, lim_prov = rest
    assert (k_org, k_cred, k_prov) == ("{adm}:org:org-1", "{adm}:cred:key-1", "{adm}:prov:openai")
    assert all(k.startswith("{adm}:") for k in (k_org, k_cred, k_prov))
    assert float(now) > 1_700_000_000
    assert (int(ttl), lease) == (1860, "lease-1")
    assert (int(lim_org), int(lim_cred), int(lim_prov)) == (4, 2, 6)


def test_the_limits_come_from_app_settings(limits):
    limits.outside_inflight_per_org, limits.outside_inflight_per_key = 9, 7
    limits.outside_inflight_per_provider = 11
    redis = FakeRedis([0])
    _acquire(redis)
    assert [int(x) for x in redis.evals[0][-3:]] == [9, 7, 11]


def test_a_missing_provider_is_keyed_unknown():
    redis = FakeRedis([0])
    _acquire(redis, provider=None)
    assert redis.evals[0][4] == "{adm}:prov:unknown"


def test_redis_raising_is_outside_start_unavailable():
    with pytest.raises(adm.OutsideStartUnavailable):
        _acquire(FakeRedis(raises=ConnectionError("down")))


def test_a_settings_read_failure_also_refuses(monkeypatch):
    async def _boom():
        raise RuntimeError("no settings")

    monkeypatch.setattr(adm, "load_app_settings_async", _boom)
    with pytest.raises(adm.OutsideStartUnavailable):
        _acquire(FakeRedis([0]))


def test_release_zrems_the_lease_from_all_three_keys():
    redis = FakeRedis()
    asyncio.run(adm.release(redis, org_id="org-1", credential_id="key-1", provider="openai",
                            lease_id="lease-1"))
    assert sorted(redis.zrems) == sorted([
        ("{adm}:org:org-1", "lease-1"), ("{adm}:cred:key-1", "lease-1"),
        ("{adm}:prov:openai", "lease-1"),
    ])


def test_release_swallows_a_redis_error():
    redis = FakeRedis(zrem_raises=True)
    asyncio.run(adm.release(redis, org_id="o", credential_id="k", provider=None, lease_id="l"))
    assert redis.zrems  # it tried


def test_the_constants():
    assert adm.ASK_LEASE_TTL_S == 900
    assert (adm.ASK_RETRY_S, adm.RUN_RETRY_S, adm.IDEM_TTL_S) == (15, 30, 86400)
    assert adm.REASON == {
        "org": "admission:org", "credential": "admission:credential",
        "provider": "admission:provider",
    }
    assert adm.UNAVAILABLE_REASON == "admission_unavailable"


def test_the_run_lease_outlives_the_inbound_max_duration_by_a_minute():
    from app.api import inbound  # noqa: PLC0415 — the test may import app.api; the module may not

    assert adm.RUN_LEASE_TTL_S == inbound._DEFAULT_MAX_DURATION + 60


def test_the_sentences_are_the_ui_spec_words():
    assert adm.INBOUND_FULL_SENTENCE["credential"].format(retry=30) == (
        "Too many runs are already in progress for this key. Try again in 30 seconds."
    )
    assert adm.INBOUND_FULL_SENTENCE["org"].format(retry=30) == (
        "Too many runs are already in progress in this organisation. Try again in 30 seconds."
    )
    assert adm.INBOUND_FULL_SENTENCE["provider"].format(retry=30) == (
        "The AI provider is busy with other outside requests. Try again in 30 seconds."
    )
    assert adm.MCP_FULL_SENTENCE["credential"].format(retry=15) == (
        "Too many questions and runs are already in progress for this key. "
        "Try again in 15 seconds."
    )
    assert adm.MCP_FULL_SENTENCE["org"].format(retry=15) == (
        "Too many questions and runs are already in progress in this organisation. "
        "Try again in 15 seconds."
    )
    assert adm.MCP_FULL_SENTENCE["provider"].format(retry=15) == (
        "The AI provider is busy with other outside requests. Try again in 15 seconds."
    )


# ── static fences ──────────────────────────────────────────────────────────────────────────


def test_no_counter_increment_anywhere_in_the_module():
    # D-35: leases are sorted-set members, never a counter whose TTL refresh leaks slots.
    assert "incr" not in _SRC.lower()


def test_one_expiry_sweep_and_three_hash_tagged_key_prefixes():
    assert _SRC.count("ZREMRANGEBYSCORE") == 1
    assert _SRC.count("{adm}:") >= 3


def test_the_module_imports_no_api_and_no_in_app_run_path():
    tree = ast.parse(_SRC)
    mods = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            mods.append(node.module)
        elif isinstance(node, ast.Import):
            mods.extend(a.name for a in node.names)
    bad = [m for m in mods if re.match(
        r"app\.(api|services\.agent_loop|services\.run_producer)", m)]
    assert bad == []


def test_no_in_app_path_calls_admission():
    # D-16: the in-app chat and kickoff never meet the check.
    root = Path(adm.__file__).resolve().parents[1]
    for rel in ("api/threads.py", "services/workflow_kickoff.py", "services/agent_loop.py"):
        assert "outside_admission" not in (root / rel).read_text(encoding="utf-8"), rel
