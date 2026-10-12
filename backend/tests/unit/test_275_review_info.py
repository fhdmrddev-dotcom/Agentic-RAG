"""Phase 275 code-review fix pass (275-REVIEW-backend.md) — the two Info findings fixed in place.

* **B-IN-04** — ``get_related_documents(retrievable_only=True)`` (the agent's read) no longer resolves
  an archived / source-gone SUBJECT (D-18); the Library's read (``retrievable_only=False``) still does.
* **B-IN-05** — ``extend_hold`` racing a release answers 409 with the release sentence, never a 500.
"""
from __future__ import annotations

import asyncio

import asyncpg
import pytest

from app.services import document_relationship_service as rel

CALLER = "00000000-0000-0000-0000-000000000001"
SUBJ = "55555555-5555-4555-8555-555555555555"


def _subject(retrievable):
    return {"id": SUBJ, "filename": "a.pdf", "user_id": CALLER, "retrievable": retrievable}


@pytest.mark.parametrize("retrievable_only, retrievable, resolved", [
    (True, False, False),   # the agent never resolves an archived subject
    (False, False, True),   # the Library still shows it
    (True, True, True),     # control: a live subject resolves for the agent
])
def test_in04_an_archived_subject_is_not_resolved_for_the_agent(monkeypatch, retrievable_only, retrievable, resolved):
    async def _resolve(doc, caller, *, by_filename, supabase):
        return _subject(retrievable)

    async def _versions(subject, *, supabase):
        return [SUBJ]

    class _Q:
        def __getattr__(self, name):
            return lambda *a, **k: self

        def execute(self):
            return type("R", (), {"data": []})()

    class _Client:
        def table(self, name):
            return _Q()

    monkeypatch.setattr(rel, "_resolve_readable_latest", _resolve)
    monkeypatch.setattr(rel, "_subject_version_ids", _versions)
    monkeypatch.setattr(rel, "_client", lambda supabase: _Client())
    out = asyncio.run(rel.get_related_documents(
        document_id=SUBJ, caller=CALLER, supabase=object(), retrievable_only=retrievable_only,
    ))
    assert (out is not None) is resolved, out


def test_in05_extending_a_hold_that_was_released_mid_request_is_409(monkeypatch, mock_asyncpg_pool):
    from fastapi.testclient import TestClient

    from app.api import retention as api
    from app.db import retention as rdb
    from tests.unit.test_275_retention_api import ACTIVE_ORG, DOC, HOLD, _h, _member_of_org, _perms

    _member_of_org(monkeypatch, mock_asyncpg_pool, role="admin")
    _perms(monkeypatch, manage=True)
    reads = iter([
        {"id": HOLD, "org_id": ACTIVE_ORG, "name": "Halden v. Crane", "released_at": None},
        {"id": HOLD, "org_id": ACTIVE_ORG, "name": "Halden v. Crane", "released_at": "2026-10-12T09:00:00Z"},
    ])

    async def _get_hold(pool, org, hold_id):
        return next(reads)

    async def _readable(conn, org, doc_ids, folder_ids):
        return {str(d) for d in doc_ids}, {str(f) for f in folder_ids}

    async def _write(*a, **k):
        raise asyncpg.exceptions.CheckViolationError(
            "legal hold coverage must stay inside the organization of an active hold"
        )

    def _never(*a, **k):
        raise AssertionError("a receipt was written for coverage that was never added")

    monkeypatch.setattr(rdb, "get_hold", _get_hold)
    monkeypatch.setattr(api, "_readable_ids", _readable)
    monkeypatch.setattr(api, "_write_coverage", _write)
    monkeypatch.setattr(rdb, "insert_receipt", _never)

    from fastapi import FastAPI

    from app.main import app as real_app

    probe = FastAPI()
    probe.include_router(api.router)
    probe.dependency_overrides = real_app.dependency_overrides
    res = TestClient(probe).post(f"/retention/holds/{HOLD}/coverage", headers=_h(), json={"document_ids": [DOC]})
    assert res.status_code == 409, res.text
    assert res.json()["detail"] == "This hold has been released. Place a new hold instead."
