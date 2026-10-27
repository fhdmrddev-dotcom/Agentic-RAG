"""293-REVIEW CR-02 — a refused call can no longer amplify into unbounded audit writes.

Before this fix every refusal by a known key awaited one ``audit_log`` insert before answering:
a leaked-then-revoked key replayed as fast as a client can send wrote one row per replay into the
victim org's audit log (the resolver runs BEFORE the per-key limiter), and the limiter's own 429
wrote a row per over-limit call, so the limiter bounded runs but not database writes. Unknown keys
had no per-client bound at all.

Pinned here:
  * the same refusal (key, reason) writes at most ONE audit row per minute; the next written row
    carries how many were suppressed, so nothing is silently lost;
  * with Redis down the bound still holds per worker (it falls back to an in-process window; it
    never writes unbounded);
  * the over-limit 429 is throttled the same way;
  * a per-client limiter runs on ``/inbound/*`` BEFORE key resolution, so an unknown-key flood is
    refused without a digest lookup per call.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.security import api_key_auth as auth
from app.services import rate_limit
from tests.unit.phase293_inbound_fakes import (
    FakePool,
    FakeRedis,
    all_audits,
    audit_spies,
    build_app,
    make_key,
)

ORG_ID = "44444444-4444-4444-8444-444444444444"
USER_ID = "33333333-3333-4333-8333-333333333333"
MINUTE = 1_800_000_000  # a minute boundary


class _BrokenPipe:
    async def __aenter__(self):
        raise ConnectionError("redis is down")

    async def __aexit__(self, *exc):
        return False


class _BrokenRedis(FakeRedis):
    def pipeline(self, transaction=True):
        return _BrokenPipe()


@pytest.fixture
def clock(monkeypatch):
    now = {"t": MINUTE + 5}
    clock_ns = SimpleNamespace(time=lambda: now["t"])
    monkeypatch.setattr(rate_limit, "time", clock_ns)  # the per-client limiter's window
    monkeypatch.setattr(auth, "time", clock_ns)  # the refusal-audit window
    return now


@pytest.fixture
def revoked(monkeypatch):
    """A revoked key the resolver can attribute, a fresh id per test (no shared window state)."""
    minted = auth.mint_key()
    row = {
        "id": str(uuid.uuid4()), "org_id": ORG_ID, "user_id": USER_ID, "label": "leaked",
        "key_prefix": minted.key_prefix, "key_hash": minted.key_hash, "workflows": [],
        "expires_at": None, "revoked_at": datetime.now(timezone.utc) - timedelta(days=1),
    }
    audits: list[dict] = []

    async def _get(pool, key_hash):
        return dict(row) if key_hash == row["key_hash"] else None

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        audits.append({"action_type": action_type, "metadata": metadata})

    monkeypatch.setattr(auth.api_keys_db, "get_key_for_auth", _get)
    monkeypatch.setattr(auth, "write_audit_entry", _write)
    monkeypatch.setattr(auth, "get_service_role_supabase", lambda org_id: object())
    return {"secret": minted.secret, "row": row, "audits": audits}


def _probe(redis) -> TestClient:
    app = FastAPI()
    app.dependency_overrides[deps.get_pg_pool] = lambda: object()
    app.dependency_overrides[deps.get_redis] = lambda: redis

    @app.get("/probe")
    async def probe(key: auth.ResolvedKey = Depends(auth.resolve_api_key)):
        return {"id": key.id}

    return TestClient(app)


def _replay(client, secret, n):
    return [client.get("/probe", headers={"Authorization": f"Bearer {secret}"}) for _ in range(n)]


def test_a_replayed_revoked_key_writes_one_refusal_row_a_minute(clock, revoked):
    client = _probe(FakeRedis())
    answers = _replay(client, revoked["secret"], 5)
    assert {r.status_code for r in answers} == {401}
    assert len({r.content for r in answers}) == 1  # still one byte-identical body (D-06)
    assert len(revoked["audits"]) == 1, revoked["audits"]
    assert revoked["audits"][0]["metadata"]["reason"] == "revoked"


def test_the_next_written_row_carries_the_suppressed_count(clock, revoked):
    client = _probe(FakeRedis())
    _replay(client, revoked["secret"], 5)
    clock["t"] += 60
    _replay(client, revoked["secret"], 1)
    assert len(revoked["audits"]) == 2, revoked["audits"]
    assert revoked["audits"][1]["metadata"]["detail"] == {"suppressed": 4}


def test_with_redis_down_the_refusal_rows_stay_bounded(clock, revoked):
    client = _probe(_BrokenRedis())
    answers = _replay(client, revoked["secret"], 5)
    assert {r.status_code for r in answers} == {401}
    assert len(revoked["audits"]) == 1, revoked["audits"]


def test_the_over_limit_429_is_throttled_too(monkeypatch, clock):
    events: list = []
    now, later, limiter = audit_spies(monkeypatch, events)

    async def _over(_redis, *, key_id, kind):
        raise HTTPException(429, detail="Too many status reads.", headers={"Retry-After": "7"})

    limiter.side_effect = _over
    client = TestClient(build_app(key=make_key(id=str(uuid.uuid4())), pool=FakePool(events),
                                  redis=FakeRedis()))
    answers = [client.get(f"/inbound/runs/{uuid.uuid4()}") for _ in range(5)]
    assert {r.status_code for r in answers} == {429}
    refusals = [a for a in all_audits(now, later) if a[0] == "api_key.refused"]
    assert len(refusals) == 1, refusals
    assert refusals[0][1]["reason"] == "over_limit"


def test_a_per_client_limit_runs_before_key_resolution(monkeypatch, clock):
    lookups: list[str] = []

    async def _get(pool, key_hash):
        lookups.append(key_hash)
        return None

    monkeypatch.setattr(auth.api_keys_db, "get_key_for_auth", _get)
    monkeypatch.setattr(rate_limit, "IP_CALLS_PER_MINUTE", 3, raising=False)
    client = TestClient(build_app(key=None, pool=FakePool(), redis=FakeRedis()))

    answers = [
        client.get(f"/inbound/runs/{uuid.uuid4()}",
                   headers={"Authorization": f"Bearer {auth.mint_key().secret}"})
        for _ in range(5)
    ]
    assert [r.status_code for r in answers] == [401, 401, 401, 429, 429]
    assert answers[3].headers.get("Retry-After") == "55"
    assert len(lookups) == 3, "an over-limit client must not reach the key lookup"


def test_a_call_with_no_key_still_reads_the_no_key_sentence_under_the_limit(clock):
    client = TestClient(build_app(key=None, pool=FakePool(), redis=FakeRedis()))
    r = client.get(f"/inbound/runs/{uuid.uuid4()}")
    assert r.status_code == 401
    assert r.json() == {"detail": auth.NO_KEY_DETAIL}
