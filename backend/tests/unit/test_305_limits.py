"""Phase 305-03 (KEY-07; D-27 / D-28 / D-54; T-305-13) — the two per-key MCP buckets.

* ``search_knowledge_base`` counts against the EXPENSIVE bucket (kind ``expensive``, limited by
  ``api_key_searches_per_minute``); ``list_documents`` and ``read_document`` against the CHEAP one
  (kind ``read``, ``api_key_reads_per_minute``). The two counters are independent.
* Over the limit is a SENTENCE the caller's model can relay, never an HTTP 429.
* Redis raising is a refusal carrying ``UNAVAILABLE_DETAIL`` (fail closed).
* ``enforce_key_limit`` (the /inbound limiter) stays byte-unchanged: its source hash is pinned.
"""
from __future__ import annotations

import hashlib
import inspect
import re
from dataclasses import replace

import pytest

from app.models.user_settings import _build_settings_from_row
from app.services import rate_limit
from tests.unit import _mcp305_harness as h
from tests.unit.phase293_inbound_fakes import FakeRedis

# sha256 of ``inspect.getsource(rate_limit.enforce_key_limit)`` (LF-normalised) at the 305-03 base
# 7ef6ea349. A change to the /inbound limiter is a different phase's decision, never this one's.
ENFORCE_KEY_LIMIT_SHA = "76089d5f311c59db998644b51060b1b38a53d5e62d9ed368e892f1a76c62ce53"


@pytest.fixture
def knobs(monkeypatch):
    values = {"api_key_reads_per_minute": 3, "api_key_searches_per_minute": 2}

    async def _load():
        return _build_settings_from_row(dict(values))

    monkeypatch.setattr(rate_limit, "load_app_settings_async", _load)
    return values


def _spec(name):
    from app.mcp import tools

    return tools.REGISTERED[name]


async def test_search_counts_on_the_expensive_bucket_with_the_searches_knob(knobs):
    from app.mcp import limits

    redis = FakeRedis()
    principal = h.PRINCIPAL
    assert await limits.check_limit(principal, _spec("search_knowledge_base"), redis) is None
    keys = [k for k in redis.store if k.startswith("apikey:rl:")]
    assert keys and all(k.startswith(f"apikey:rl:expensive:{principal.key_id}:") for k in keys)
    assert await limits.check_limit(principal, _spec("search_knowledge_base"), redis) is None
    refused = await limits.check_limit(principal, _spec("search_knowledge_base"), redis)
    assert refused is not None
    assert refused.reason == "rate_limited:expensive"
    assert refused.limit == 2
    m = re.fullmatch(
        r"This key has made too many searches in the last minute\. Try again in (\d+) seconds\.",
        refused.sentence,
    )
    assert m, refused.sentence
    assert 1 <= int(m.group(1)) <= 60


@pytest.mark.parametrize("tool", ["list_documents", "read_document"])
async def test_list_and_read_count_on_the_read_bucket_with_the_reads_knob(knobs, tool):
    from app.mcp import limits

    redis = FakeRedis()
    for _ in range(3):
        assert await limits.check_limit(h.PRINCIPAL, _spec(tool), redis) is None
    keys = [k for k in redis.store if k.startswith("apikey:rl:")]
    assert keys and all(k.startswith(f"apikey:rl:read:{h.PRINCIPAL.key_id}:") for k in keys)
    refused = await limits.check_limit(h.PRINCIPAL, _spec(tool), redis)
    assert refused is not None and refused.reason == "rate_limited:read" and refused.limit == 3
    assert re.fullmatch(
        r"This key has made too many reads in the last minute\. Try again in (\d+) seconds\.",
        refused.sentence,
    ), refused.sentence


async def test_an_exhausted_search_bucket_never_refuses_a_read(knobs):
    from app.mcp import limits

    redis = FakeRedis()
    for _ in range(5):
        await limits.check_limit(h.PRINCIPAL, _spec("search_knowledge_base"), redis)
    assert await limits.check_limit(h.PRINCIPAL, _spec("search_knowledge_base"), redis) is not None
    assert await limits.check_limit(h.PRINCIPAL, _spec("read_document"), redis) is None


async def test_two_keys_have_two_counters(knobs):
    from app.mcp import limits

    redis = FakeRedis()
    other = replace(h.PRINCIPAL, key_id="44444444-4444-4444-8444-444444444444")
    for _ in range(2):
        await limits.check_limit(h.PRINCIPAL, _spec("search_knowledge_base"), redis)
    assert await limits.check_limit(other, _spec("search_knowledge_base"), redis) is None


class _Down:
    def pipeline(self, transaction=True):
        raise ConnectionError("redis is down")


async def test_redis_down_is_a_refusal_with_the_unavailable_sentence(knobs):
    from app.mcp import limits

    refused = await limits.check_limit(h.PRINCIPAL, _spec("search_knowledge_base"), _Down())
    assert refused is not None
    assert refused.reason == "limiter_unavailable"
    assert refused.sentence == rate_limit.UNAVAILABLE_DETAIL
    assert refused.limit is None


async def test_check_key_limit_returns_the_limit_and_raises_when_it_cannot_count(knobs):
    limit, retry = await rate_limit.check_key_limit(FakeRedis(), key_id="k", kind="expensive")
    assert (limit, retry) == (2, None)
    limit, retry = await rate_limit.check_key_limit(FakeRedis(), key_id="k", kind="read")
    assert (limit, retry) == (3, None)
    with pytest.raises(rate_limit.LimiterUnavailable):
        await rate_limit.check_key_limit(_Down(), key_id="k", kind="expensive")


def test_enforce_key_limit_is_byte_unchanged():
    source = inspect.getsource(rate_limit.enforce_key_limit).replace("\r\n", "\n")
    assert hashlib.sha256(source.encode()).hexdigest() == ENFORCE_KEY_LIMIT_SHA


def test_the_buckets_come_from_the_tool_specs():
    from app.mcp import tools

    assert tools.REGISTERED["search_knowledge_base"].bucket == "expensive"
    assert tools.REGISTERED["list_documents"].bucket == "cheap"
    assert tools.REGISTERED["read_document"].bucket == "cheap"
