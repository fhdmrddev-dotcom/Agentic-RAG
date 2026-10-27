"""293-REVIEW WR-01 — a status read's file link is an ABSOLUTE URL that works behind a prefix.

The link used to be root-relative (``/inbound/files/<token>``). The onebox serves the API behind
nginx at ``/api/`` and strips the prefix, so a caller resolving that link against the host (as RFC
3986 says to) got the SPA's HTML instead of the file.

Pinned here: the link is built from ``BACKEND_PUBLIC_URL`` (the app's one "where a third party
reaches this API" setting), and when that is still the loopback default while the caller reached
us elsewhere, from the request itself: ``X-Forwarded-Proto`` / ``X-Forwarded-Host`` /
``X-Forwarded-Prefix`` (or the ASGI ``root_path``), each accepted only in a safe shape.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.unit.phase293_inbound_fakes import (
    FILE_ID,
    ORG_ID,
    RUN_ID,
    THREAD_ID,
    USER_ID,
    FakePool,
    FakeRedis,
    audit_spies,
    build_app,
    make_key,
)

URL = f"/inbound/runs/{RUN_ID}"


@pytest.fixture
def read(monkeypatch):
    from unittest.mock import AsyncMock

    from app.config import settings

    audit_spies(monkeypatch)
    monkeypatch.setattr("app.db.workflows.get_unanswered_ask_user", AsyncMock(return_value=None))
    pool = FakePool()
    pool.run_row = {"id": RUN_ID, "thread_id": THREAD_ID, "status": "completed",
                    "user_id": USER_ID, "org_id": ORG_ID, "definition_snapshot": None}
    pool.file_rows = [{"id": FILE_ID, "path": "/out/digest.docx", "size_bytes": 10}]

    def _get(public_url: str, headers: dict | None = None, root_path: str = "") -> str:
        monkeypatch.setattr(settings, "backend_public_url", public_url)
        client = TestClient(build_app(key=make_key(), pool=pool, redis=FakeRedis()),
                            root_path=root_path)
        r = client.get(URL, headers=headers or {})
        assert r.status_code == 200, r.text
        [f] = r.json()["files"]
        return f["url"]

    return _get


def _token(url: str) -> str:
    return url.rsplit("/", 1)[1]


def test_a_configured_public_url_is_the_base(read):
    url = read("https://api.example.com/", headers={"Host": "backend:8000"})
    assert url == f"https://api.example.com/inbound/files/{_token(url)}"


def test_behind_the_onebox_prefix_the_forwarded_headers_build_the_link(read):
    url = read("http://localhost:8000", headers={
        "Host": "syrel.example.com", "X-Forwarded-Proto": "https", "X-Forwarded-Prefix": "/api",
    })
    assert url == f"https://syrel.example.com/api/inbound/files/{_token(url)}"


def test_the_asgi_root_path_counts_as_the_prefix(read):
    url = read("http://localhost:8000", headers={"Host": "syrel.example.com"}, root_path="/api")
    assert url == f"http://syrel.example.com/api/inbound/files/{_token(url)}"


def test_local_dev_reads_the_loopback_url_unchanged(read):
    url = read("http://localhost:8000", headers={"Host": "localhost:8000"})
    assert url == f"http://localhost:8000/inbound/files/{_token(url)}"


def test_a_malformed_forwarded_value_is_ignored(read):
    url = read("http://localhost:8000", headers={
        "Host": "syrel.example.com", "X-Forwarded-Proto": "javascript",
        "X-Forwarded-Prefix": '/api"><b>', "X-Forwarded-Host": "evil.example.com/x?",
    })
    assert url == f"http://syrel.example.com/inbound/files/{_token(url)}"
