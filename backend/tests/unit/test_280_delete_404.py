"""Phase 280 plan 01 Task 2 (DEBT-11 / D-09 / BUG-261012-02) — DELETE /documents/{id} answers 404.

⛔ THE DEFECT. postgrest 2.29's ``SyncMaybeSingleRequestBuilder.execute`` returns ``None`` on a
0-row match. ``delete_document`` read ``doc_resp.data`` off that ``None`` → ``AttributeError`` →
a 500 produced by Starlette's ``ServerErrorMiddleware``, which sits OUTSIDE ``CORSMiddleware`` — so
the browser also saw a CORS failure instead of the handler's own 404.

⚠ WHY NO EARLIER TEST SAW IT. Every existing fake (``test_270_download_url.py``,
``test_275_delete_paths.py``) answers a 0-row ``maybe_single()`` with ``SimpleNamespace(data=None)``
— an object postgrest 2.29 never returns. This fake returns ``None``, as the real client does.

⭐ D-09 (no existence oracle): another user's row and a nonexistent id are the SAME owner-filtered
0-row miss, so both answer the identical ``404 {"detail": "Document not found"}`` with CORS headers.
A disallowed Origin is the positive control that the CORS assertion can fail.
"""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.dependencies import get_supabase, get_user_supabase_client
from app.main import app

USER_ID = "00000000-0000-0000-0000-000000000001"  # conftest mock_user_data
OTHER_ID = "00000000-0000-0000-0000-0000000000aa"
FOREIGN_DOC = "11111111-1111-4111-8111-111111111111"
ALLOWED_ORIGIN = "http://localhost:5173"


class _Query:
    """A supabase-py builder double whose 0-row ``maybe_single().execute()`` returns None."""

    def __init__(self, owner, table):
        self.owner, self.table_name = owner, table
        self.eqs: dict = {}
        self.single = False

    def select(self, *_a, **_k):
        return self

    def eq(self, k, v):
        self.eqs[k] = v
        return self

    def maybe_single(self):
        self.single = True
        return self

    def __getattr__(self, name):  # delete / in_ / neq / … — any other chained call
        def _chain(*_a, **_k):
            self.owner.log.append(("chain", self.table_name, name))
            return self

        return _chain

    def execute(self):
        rows = [
            r for r in self.owner.rows.get(self.table_name, [])
            if all(str(r.get(k)) == str(v) for k, v in self.eqs.items())
        ]
        self.owner.log.append(("execute", self.table_name, dict(self.eqs)))
        if self.single:
            # postgrest 2.29 SyncMaybeSingleRequestBuilder.execute: None on 0 rows
            if not rows:
                return None
            return type("R", (), {"data": rows[0]})()
        return type("R", (), {"data": rows})()


class _Bucket:
    def __init__(self, owner):
        self.owner = owner

    def remove(self, paths):
        self.owner.log.append(("storage", "remove", list(paths)))
        return []


class _Storage:
    def __init__(self, owner):
        self.owner = owner

    def from_(self, _bucket):
        return _Bucket(self.owner)


class _Client:
    def __init__(self, rows):
        self.rows = rows
        self.log: list = []
        self.storage = _Storage(self)

    def table(self, name):
        return _Query(self, name)


def _client():
    rows = {"documents": [{"id": FOREIGN_DOC, "user_id": OTHER_ID, "filename": "theirs.pdf",
                           "file_path": f"{OTHER_ID}/{FOREIGN_DOC}/theirs.pdf", "is_latest": True}]}
    user = _Client(rows)
    service = _Client(rows)
    app.dependency_overrides[get_user_supabase_client] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: service
    return TestClient(app, raise_server_exceptions=False), user


def _no_mutation(user: _Client) -> bool:
    return not [e for e in user.log if e[0] == "storage" or (e[0] == "chain" and e[2] == "delete")]


def test_delete_a_foreign_document_is_404_with_cors():
    tc, user = _client()
    res = tc.delete(f"/documents/{FOREIGN_DOC}", headers={"Origin": ALLOWED_ORIGIN})
    assert res.status_code == 404, res.text
    assert res.json() == {"detail": "Document not found"}
    assert res.headers.get("access-control-allow-origin") == ALLOWED_ORIGIN
    assert _no_mutation(user)


def test_delete_a_nonexistent_document_is_404_with_cors():
    tc, user = _client()
    res = tc.delete(f"/documents/{uuid.uuid4()}", headers={"Origin": ALLOWED_ORIGIN})
    assert res.status_code == 404, res.text
    assert res.json() == {"detail": "Document not found"}
    assert res.headers.get("access-control-allow-origin") == ALLOWED_ORIGIN
    assert _no_mutation(user)


def test_foreign_and_nonexistent_bodies_are_identical_no_existence_oracle():
    tc, _ = _client()
    foreign = tc.delete(f"/documents/{FOREIGN_DOC}", headers={"Origin": ALLOWED_ORIGIN})
    missing = tc.delete(f"/documents/{uuid.uuid4()}", headers={"Origin": ALLOWED_ORIGIN})
    assert foreign.status_code == missing.status_code == 404
    assert foreign.content == missing.content


def test_a_disallowed_origin_gets_no_cors_header_positive_control():
    tc, _ = _client()
    res = tc.delete(f"/documents/{FOREIGN_DOC}", headers={"Origin": "https://evil.example"})
    assert res.status_code == 404, res.text
    assert "access-control-allow-origin" not in res.headers
