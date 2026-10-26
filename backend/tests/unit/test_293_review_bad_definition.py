"""293-REVIEW WR-04 — a stored definition that no longer validates is a REFUSAL, never a 500.

``parse_definition_row`` caught a JSON-decode failure but let ``WorkflowDefinition.model_validate``
raise. A published row that stops validating (the model gains a required field or a stricter
literal) made ``POST /inbound/workflows/{id}/runs`` a bare, unaudited 500, against the docstring's
"an unparseable one is logged and refused rather than raised".
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.db import api_keys as api_keys_db
from app.services import unattended_launch
from tests.unit.phase293_inbound_fakes import (
    WF_ID,
    FakePool,
    FakeRedis,
    all_audits,
    audit_spies,
    build_app,
    make_key,
)

BROKEN = {"name": "Weekly digest", "slug": "weekly-digest", "version": 1, "phases": "not-a-list"}


def test_parse_definition_row_returns_none_for_a_row_that_no_longer_validates():
    assert unattended_launch.parse_definition_row({"definition": BROKEN}, log_ref="t") is None
    assert unattended_launch.parse_definition_row(
        {"definition": json.dumps(BROKEN)}, log_ref="t"
    ) is None


def test_the_inbound_start_answers_the_audited_403_for_it(monkeypatch):
    events: list = []
    now, later, _limiter = audit_spies(monkeypatch, events)

    async def _key_workflows(_pool, **_kw):
        return [{"id": UUID(WF_ID), "readable": True, "name": "Weekly digest",
                 "status": "published", "definition": json.dumps(BROKEN)}]

    monkeypatch.setattr(api_keys_db, "get_key_workflows", _key_workflows)
    launch = AsyncMock(return_value=uuid4())
    monkeypatch.setattr("app.services.unattended_launch.launch_unattended_run", launch)
    monkeypatch.setattr(
        "app.services.entitlement_service.enforce_entitlement", AsyncMock(return_value=None)
    )
    client = TestClient(build_app(key=make_key(), pool=FakePool(events), redis=FakeRedis()),
                        raise_server_exceptions=False)

    r = client.post(f"/inbound/workflows/{WF_ID}/runs", json={"inputs": {}})

    assert r.status_code == 403, r.text
    assert r.json() == {"detail": "The key's owner can no longer run this workflow."}
    launch.assert_not_awaited()
    refusals = [a for a in all_audits(now, later) if a[0] == "api_key.refused"]
    assert [a[1]["reason"] for a in refusals] == ["cannot_run"]
