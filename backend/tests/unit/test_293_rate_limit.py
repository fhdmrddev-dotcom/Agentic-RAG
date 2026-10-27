"""Phase 293-01 (START-02; D-14, D-15; T-293-06) — the per-key limiter and its two settings.

⛔ The limiter MUST be shared by both uvicorn workers. ``api/setup.py``'s in-process dict is the
wrong model: two workers would each admit the full limit. The two-client test below is the
property — two limiter calls through two DIFFERENT client objects on ONE store share the count.

⛔ It fails CLOSED. A Redis that raises answers 503 and admits nothing uncounted (D-15).

The stub below implements exactly the slice of ``redis.asyncio`` the limiter uses:
``pipeline(transaction=True)`` as an async context manager, ``incr``, ``expire``, ``execute``.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.api.settings as settings_api
import app.models.user_settings as us
from app.models.user_settings import _build_settings_from_row
from app.services import rate_limit

KEY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


class _Store:
    def __init__(self):
        self.values: dict[str, int] = {}
        self.ttls: dict[str, int] = {}
        self.transactions: list[bool] = []


class _Pipe:
    def __init__(self, store: _Store, transaction: bool):
        self.store, self.ops = store, []
        store.transactions.append(transaction)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def incr(self, key):
        self.ops.append(("incr", key))
        return self

    def expire(self, key, seconds):
        self.ops.append(("expire", key, seconds))
        return self

    async def execute(self):
        out = []
        for op in self.ops:
            if op[0] == "incr":
                self.store.values[op[1]] = self.store.values.get(op[1], 0) + 1
                out.append(self.store.values[op[1]])
            else:
                self.store.ttls[op[1]] = op[2]
                out.append(True)
        return out


class _Redis:
    """One CLIENT over a shared store — two of these are two workers on one Redis."""

    def __init__(self, store: _Store):
        self.store = store

    def pipeline(self, transaction=True):
        return _Pipe(self.store, transaction)


class _BrokenRedis:
    def pipeline(self, transaction=True):
        raise ConnectionError("redis is down")


@pytest.fixture
def frozen(monkeypatch):
    """Pin the clock 15 seconds into a minute, so the window has 45 seconds left."""
    now = 1_800_000_015  # 1_800_000_000 is a minute boundary (divisible by 60)
    assert 1_800_000_000 % 60 == 0
    monkeypatch.setattr(rate_limit, "time", SimpleNamespace(time=lambda: now))
    return now


@pytest.fixture
def limits(monkeypatch):
    values = {"api_key_starts_per_minute": 10, "api_key_reads_per_minute": 120}

    async def _load():
        return _build_settings_from_row(dict(values))

    monkeypatch.setattr(rate_limit, "load_app_settings_async", _load)
    return values


# ── hit() ──────────────────────────────────────────────────────────────────────────────────────


async def test_the_tenth_start_passes_and_the_eleventh_returns_retry_after(frozen):
    r = _Redis(_Store())
    for _ in range(10):
        assert await rate_limit.hit(r, key_id=KEY, kind="start", limit=10) is None
    retry = await rate_limit.hit(r, key_id=KEY, kind="start", limit=10)
    assert retry == 45
    assert 1 <= retry <= 60


async def test_the_bucket_key_is_per_kind_per_key_per_minute_and_expires(frozen):
    store = _Store()
    await rate_limit.hit(_Redis(store), key_id=KEY, kind="start", limit=10)
    bucket = f"apikey:rl:start:{KEY}:{frozen // 60}"
    assert store.values == {bucket: 1}
    assert store.ttls == {bucket: 120}
    assert store.transactions == [True]   # MULTI/EXEC — INCR and EXPIRE are one unit


async def test_two_clients_on_one_redis_share_the_count(frozen):
    """The two-worker property (D-15)."""
    store = _Store()
    worker_a, worker_b = _Redis(store), _Redis(store)
    for i in range(10):
        w = worker_a if i % 2 == 0 else worker_b
        assert await rate_limit.hit(w, key_id=KEY, kind="start", limit=10) is None
    assert await rate_limit.hit(worker_b, key_id=KEY, kind="start", limit=10) is not None
    assert await rate_limit.hit(worker_a, key_id=KEY, kind="start", limit=10) is not None


async def test_start_and_read_buckets_are_independent(frozen):
    r = _Redis(_Store())
    for _ in range(10):
        await rate_limit.hit(r, key_id=KEY, kind="start", limit=10)
    assert await rate_limit.hit(r, key_id=KEY, kind="start", limit=10) is not None
    assert await rate_limit.hit(r, key_id=KEY, kind="read", limit=120) is None


async def test_two_keys_have_independent_buckets(frozen):
    r = _Redis(_Store())
    for _ in range(11):
        await rate_limit.hit(r, key_id=KEY, kind="start", limit=10)
    assert await rate_limit.hit(r, key_id="other-key", kind="start", limit=10) is None


async def test_retry_after_is_never_zero_on_a_minute_boundary(monkeypatch):
    monkeypatch.setattr(rate_limit, "time", SimpleNamespace(time=lambda: 1_800_000_000))
    r = _Redis(_Store())
    await rate_limit.hit(r, key_id=KEY, kind="start", limit=0)
    retry = await rate_limit.hit(r, key_id=KEY, kind="start", limit=0)
    assert 1 <= retry <= 60


# ── enforce_key_limit() ────────────────────────────────────────────────────────────────────────


async def test_enforce_admits_under_the_limit(frozen, limits):
    r = _Redis(_Store())
    for _ in range(10):
        await rate_limit.enforce_key_limit(r, key_id=KEY, kind="start")


async def test_enforce_refuses_the_eleventh_start_with_429_and_retry_after(frozen, limits):
    r = _Redis(_Store())
    for _ in range(10):
        await rate_limit.enforce_key_limit(r, key_id=KEY, kind="start")
    with pytest.raises(HTTPException) as exc:
        await rate_limit.enforce_key_limit(r, key_id=KEY, kind="start")
    assert exc.value.status_code == 429
    assert exc.value.headers == {"Retry-After": "45"}
    assert exc.value.detail == (
        "Too many starts: this key may start 10 runs a minute. Try again in 45 seconds."
    )


async def test_enforce_reads_its_limits_from_app_settings(frozen, limits):
    limits["api_key_reads_per_minute"] = 12
    r = _Redis(_Store())
    for _ in range(12):
        await rate_limit.enforce_key_limit(r, key_id=KEY, kind="read")
    with pytest.raises(HTTPException) as exc:
        await rate_limit.enforce_key_limit(r, key_id=KEY, kind="read")
    assert exc.value.status_code == 429
    assert exc.value.detail == (
        "Too many status reads: this key may read 12 times a minute. Try again in 45 seconds."
    )


async def test_a_redis_that_raises_fails_closed_with_503(frozen, limits):
    with pytest.raises(HTTPException) as exc:
        await rate_limit.enforce_key_limit(_BrokenRedis(), key_id=KEY, kind="start")
    assert exc.value.status_code == 503
    assert exc.value.detail == (
        "Rate limiting is unavailable right now, so this call was refused. Try again in a minute."
    )


def test_the_limiter_is_not_the_in_process_dict():
    src = open(rate_limit.__file__, encoding="utf-8").read()
    assert "apikey:rl:" in src
    assert "dict[str, list[float]]" not in src


# ── the two settings (D-14) — the four places that must agree ──────────────────────────────────

FIELDS = ["api_key_starts_per_minute", "api_key_reads_per_minute"]
DEFAULTS = {"api_key_starts_per_minute": 10, "api_key_reads_per_minute": 120}
BOUNDS = {"api_key_starts_per_minute": (1, 60), "api_key_reads_per_minute": (10, 600)}
LABELS = {
    "api_key_starts_per_minute": "Starts per minute, per key",
    "api_key_reads_per_minute": "Status reads per minute, per key",
}


def test_an_empty_row_reads_10_and_120():
    s = _build_settings_from_row({})
    assert s.api_key_starts_per_minute == 10
    assert s.api_key_reads_per_minute == 120


def test_a_stored_value_wins():
    s = _build_settings_from_row({"api_key_starts_per_minute": 3, "api_key_reads_per_minute": 40})
    assert (s.api_key_starts_per_minute, s.api_key_reads_per_minute) == (3, 40)


def test_the_model_defaults():
    for name, default in DEFAULTS.items():
        assert us.UserEffectiveSettings.model_fields[name].default == default


async def test_get_settings_exposes_both_limits():
    for name in FIELDS:
        assert name in settings_api.FullSettingsResponse.model_fields
        assert name in settings_api.SettingsUpdate.model_fields
    resp = await settings_api._build_response(_build_settings_from_row({}))
    assert resp.api_key_starts_per_minute == 10
    assert resp.api_key_reads_per_minute == 120


@pytest.fixture
def saved(monkeypatch) -> dict:
    captured: dict = {"calls": 0, "updates": {}}

    async def _columns_exist() -> bool:
        return True

    async def _save(updates):
        captured["calls"] += 1
        captured["updates"].update(updates)
        return True

    async def _load():
        return _build_settings_from_row({})

    async def _response(*_a, **_kw):
        return "response-not-under-test"

    monkeypatch.setattr(settings_api, "app_settings_has_hnsw_columns", _columns_exist)
    monkeypatch.setattr(settings_api, "save_app_settings", _save)
    monkeypatch.setattr(settings_api, "load_app_settings_async", _load)
    monkeypatch.setattr(settings_api, "_build_response", _response)
    return captured


def _put(**kwargs):
    return asyncio.run(
        settings_api.update_settings(
            body=settings_api.SettingsUpdate(**kwargs),
            background_tasks=MagicMock(),
            current_user={"id": "u-293", "email": "t@example.com"},
            supabase=MagicMock(),
        )
    )


@pytest.mark.parametrize(
    "field,bad",
    [
        ("api_key_starts_per_minute", 0),
        ("api_key_starts_per_minute", 61),
        ("api_key_reads_per_minute", 9),
        ("api_key_reads_per_minute", 601),
    ],
)
def test_the_put_refuses_out_of_range(saved, field, bad):
    with pytest.raises(HTTPException) as exc:
        _put(**{field: bad})
    assert exc.value.status_code == 400
    lo, hi = BOUNDS[field]
    detail = str(exc.value.detail)
    assert LABELS[field] in detail
    assert str(lo) in detail and str(hi) in detail
    assert saved["calls"] == 0


@pytest.mark.parametrize("field", FIELDS)
def test_the_refusal_routes_through_the_shared_helper(monkeypatch, saved, field):
    calls: list[dict] = []
    real = settings_api._range_refusal_detail

    async def _spy(**kwargs):
        calls.append(kwargs)
        return await real(**kwargs)

    monkeypatch.setattr(settings_api, "_range_refusal_detail", _spy)
    with pytest.raises(HTTPException):
        _put(**{field: 100_000})
    assert len(calls) == 1
    assert calls[0]["field"] == field
    assert (calls[0]["lo"], calls[0]["hi"]) == BOUNDS[field]
    assert calls[0]["label"] == LABELS[field]
    assert field in settings_api._BOUNDED_SETTINGS_FIELDS


@pytest.mark.parametrize(
    "field,good",
    [
        ("api_key_starts_per_minute", 1),
        ("api_key_starts_per_minute", 60),
        ("api_key_reads_per_minute", 10),
        ("api_key_reads_per_minute", 600),
    ],
)
def test_the_put_accepts_the_bounds_inclusive(saved, field, good):
    _put(**{field: good})
    assert saved["updates"].get(field) == good


def test_a_put_from_another_card_writes_neither_limit(saved):
    _put(vision_max_pages=40)
    for name in FIELDS:
        assert name not in saved["updates"]
