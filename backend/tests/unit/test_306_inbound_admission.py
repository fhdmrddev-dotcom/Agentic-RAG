"""Phase 306-02 (GUARD-01; D-16, D-17, D-19, D-35) — admission in front of ``/inbound`` starts.

After the per-key limiter and the start validation (so a bad workflow id never takes a slot), the
route takes a lease in the org / key / provider scopes. Full → 429 + ``Retry-After`` + the UI-SPEC
sentence, audited as ``api_key.refused`` with ``admission:<scope>``. Redis down → 503 with
``UNAVAILABLE_DETAIL``, audited ``admission_unavailable``. Admitted → the launch carries an
``on_finish`` that gives the lease back; a launch that raises gives it back at once.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.db import api_keys as api_keys_db
from app.services import outside_admission as adm
from app.services.rate_limit import UNAVAILABLE_DETAIL
from tests.unit.phase293_inbound_fakes import (
    DEFINITION,
    KEY_ID,
    ORG_ID,
    RUN_ID,
    USER_ID,
    WF_ID,
    FakePool,
    FakeRedis,
    all_audits,
    audit_spies,
    build_app,
    make_key,
)

URL = f"/inbound/workflows/{WF_ID}/runs"
BODY = {"inputs": {"topic": "EU energy prices"}}


@pytest.fixture
def env(monkeypatch):
    events: list = []
    pool = FakePool(events)
    redis = FakeRedis()
    now, later, limiter = audit_spies(monkeypatch, events)

    async def _key_workflows(_pool, *, workflow_ids, user_id, org_id):
        events.append("db")
        return [{"id": UUID(WF_ID), "readable": True, "name": "Weekly digest",
                 "status": "published", "definition": json.dumps(DEFINITION)}]

    monkeypatch.setattr(api_keys_db, "get_key_workflows", _key_workflows)
    launch = AsyncMock(return_value=UUID(RUN_ID))
    monkeypatch.setattr("app.services.unattended_launch.launch_unattended_run", launch)
    monkeypatch.setattr("app.services.entitlement_service.enforce_entitlement",
                        AsyncMock(return_value=None))

    owner_seen: list = []

    async def _resolve(owner_id):
        owner_seen.append(owner_id)
        return ("gpt-5", "openai")

    monkeypatch.setattr("app.services.run_model_resolution.resolve_owner_run_model", _resolve)

    async def _acquire(_redis, **kw):
        events.append(("acquire", kw))
        return adm.Admitted(lease_id=kw["lease_id"])

    acquire = AsyncMock(side_effect=_acquire)
    release = AsyncMock(return_value=None)
    monkeypatch.setattr(adm, "acquire", acquire)
    monkeypatch.setattr(adm, "release", release)
    client = TestClient(build_app(key=make_key(), pool=pool, redis=redis))
    return {"client": client, "now": now, "later": later, "limiter": limiter, "launch": launch,
            "acquire": acquire, "release": release, "events": events, "owner_seen": owner_seen,
            "redis": redis}


def _refusals(env):
    return [a for a in all_audits(env["now"], env["later"]) if a[0] == "api_key.refused"]


def test_an_admitted_start_returns_the_same_201_and_passes_on_finish(env):
    r = env["client"].post(URL, json=BODY)
    assert r.status_code == 201, r.text
    assert r.json() == {"run_id": RUN_ID, "status": "running"}
    kw = env["acquire"].await_args.kwargs
    assert (kw["org_id"], kw["credential_id"], kw["provider"]) == (ORG_ID, KEY_ID, "openai")
    assert (kw["ttl_s"], kw["retry_s"]) == (adm.RUN_LEASE_TTL_S, adm.RUN_RETRY_S)
    assert env["acquire"].await_args.args[0] is env["redis"]
    assert str(UUID(kw["lease_id"])) == kw["lease_id"]
    assert callable(env["launch"].await_args.kwargs["on_finish"])
    env["release"].assert_not_awaited()


def test_the_provider_is_the_owners_resolved_run_provider(env):
    env["client"].post(URL, json=BODY)
    assert [str(o) for o in env["owner_seen"]] == [USER_ID]


async def test_on_finish_releases_the_same_lease_once(env):
    env["client"].post(URL, json=BODY)
    on_finish = env["launch"].await_args.kwargs["on_finish"]
    lease = env["acquire"].await_args.kwargs["lease_id"]
    await on_finish("completed", UUID(RUN_ID))
    env["release"].assert_awaited_once()
    rkw = env["release"].await_args.kwargs
    assert (rkw["org_id"], rkw["credential_id"], rkw["provider"], rkw["lease_id"]) == (
        ORG_ID, KEY_ID, "openai", lease)
    assert env["release"].await_args.args[0] is env["redis"]


@pytest.mark.parametrize("scope,sentence", [
    ("credential", "Too many runs are already in progress for this key. Try again in 30 seconds."),
    ("org", "Too many runs are already in progress in this organisation. Try again in 30 seconds."),
    ("provider", "The AI provider is busy with other outside requests. Try again in 30 seconds."),
])
def test_a_full_scope_is_a_429_with_retry_after_and_the_sentence(env, scope, sentence):
    env["acquire"].side_effect = None
    env["acquire"].return_value = adm.Full(scope=scope, retry_s=30)
    r = env["client"].post(URL, json=BODY)
    assert r.status_code == 429
    assert r.headers["Retry-After"] == "30"
    assert r.json() == {"detail": sentence}
    env["launch"].assert_not_awaited()
    env["release"].assert_not_awaited()
    refused = _refusals(env)
    assert len(refused) == 1
    assert refused[0][1]["reason"] == f"admission:{scope}"
    assert refused[0][1]["call"] == "start"


def test_redis_down_is_a_503_and_admission_unavailable(env):
    env["acquire"].side_effect = adm.OutsideStartUnavailable()
    r = env["client"].post(URL, json=BODY)
    assert r.status_code == 503
    assert r.json() == {"detail": UNAVAILABLE_DETAIL}
    env["launch"].assert_not_awaited()
    refused = _refusals(env)
    assert [a[1]["reason"] for a in refused] == ["admission_unavailable"]


def test_a_launch_that_raises_releases_at_once_and_still_raises(env):
    env["launch"].side_effect = RuntimeError("launch blew up")
    with pytest.raises(RuntimeError):
        env["client"].post(URL, json=BODY)
    env["release"].assert_awaited_once()
    assert env["release"].await_args.kwargs["lease_id"] == env["acquire"].await_args.kwargs["lease_id"]


def test_a_launch_disabled_mid_request_releases_and_keeps_its_403(env):
    from app.services import unattended_launch  # noqa: PLC0415

    env["launch"].side_effect = unattended_launch.UnattendedLaunchDisabled("off")
    r = env["client"].post(URL, json=BODY)
    assert r.status_code == 403
    env["release"].assert_awaited_once()
    assert [a[1]["reason"] for a in _refusals(env)] == ["workflows_disabled"]


def test_a_bad_workflow_id_never_takes_a_slot(env):
    r = env["client"].post("/inbound/workflows/not-a-uuid/runs", json=BODY)
    assert r.status_code == 404
    env["acquire"].assert_not_awaited()


def test_admission_runs_after_the_per_key_limit(env):
    async def _over(_redis, *, key_id, kind):
        raise HTTPException(status_code=429, detail="over", headers={"Retry-After": "5"})

    env["limiter"].side_effect = _over
    r = env["client"].post(URL, json=BODY)
    assert r.status_code == 429
    env["acquire"].assert_not_awaited()


def test_admission_comes_after_the_limit_and_the_validation_reads(env):
    env["client"].post(URL, json=BODY)
    order = [e if isinstance(e, str) else e[0] for e in env["events"]]
    assert order.index("limit") < order.index("acquire")
    assert "db" in order[: order.index("acquire")]  # the validation's reads came first
