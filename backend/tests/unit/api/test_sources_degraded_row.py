"""Phase 235 Plan 07 · Task 2 — one unprojectable row degrades ONE row (`SEED-239` / D-235-13).

`GET /sources/watches` declares `response_model=list[WatchResponse]` over a loop with no per-row
boundary, and FastAPI validates the WHOLE list. So a single row that cannot be enriched — the
measured `SEED-239` shape, where one malformed `config` made all nine connections unreadable —
is a 500 for **every** watch the caller owns.

⛔ The rule this suite pins: **a source that vanishes from its own list is the definition of the
silence `LIB-10` forbids.** The broken row is therefore NAMED and returned, never dropped and
never turned into an error page. The other N−1 render exactly as they always did.

⚠ Only the OBSERVABLE half of `SEED-239` lands here. The root fix in
`connector_service.list_connections` stays with the seed.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import sources
from app.main import app as real_app

USER_ID = "00000000-0000-0000-0000-000000000001"
ORG_ID = "11111111-1111-1111-1111-111111111111"

GOOD_CONN_A = "22222222-2222-2222-2222-22222222222a"
BAD_CONN = "22222222-2222-2222-2222-2222222222bb"
GOOD_CONN_C = "22222222-2222-2222-2222-22222222222c"

WATCH_A = "33333333-3333-3333-3333-33333333333a"
WATCH_B = "33333333-3333-3333-3333-33333333333b"
WATCH_C = "33333333-3333-3333-3333-33333333333c"


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(sources.router)
    app.include_router(sources.router, prefix="/api")
    app.dependency_overrides = real_app.dependency_overrides
    return TestClient(app)


def _headers():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ORG_ID}


def _watch_row(watch_id: str, conn_id: str, name: str) -> dict:
    return {
        "id": UUID(watch_id),
        "org_id": UUID(ORG_ID),
        "user_id": UUID(USER_ID),
        "connection_id": UUID(conn_id),
        "source_folder_id": f"folder-{name}",
        "source_folder_name": name,
        "source_drive_id": None,
        "library_folder_id": None,
        "interval_minutes": 30,
        "next_run_at": None,
        "leased_until": None,
        "is_active": True,
        "last_run_at": None,
        "last_status": "pending",
        "last_error": None,
        "created_at": None,
        "updated_at": None,
    }


THREE_ROWS = [
    (WATCH_A, GOOD_CONN_A, "Finance Reports"),
    (WATCH_B, BAD_CONN, "Site Photos"),
    (WATCH_C, GOOD_CONN_C, "Contracts"),
]


class _ConnectionLookupThatBreaksOnOneRow:
    """The `SEED-239` reproduction: the per-row `connector_connections` lookup throws.

    ⚠ It throws for exactly ONE connection id. That is the point — a boundary that only proves
    itself when everything fails proves nothing about the N−1 that did not.
    """

    def __init__(self, bad_connection_id: str | None):
        self.bad = bad_connection_id

    async def fetchval(self, sql, *args):
        return 2

    async def fetchrow(self, sql, *args):
        conn_id = str(args[0]) if args else ""
        if self.bad is not None and conn_id == self.bad:
            raise RuntimeError("malformed config on connector_connections row")
        return {"name": "Team Drive", "service_id": "google"}


def _wire(monkeypatch, *, rows, bad_connection_id: str | None):
    monkeypatch.setattr("app.api.sources.list_watches", AsyncMock(return_value=rows))
    con = _ConnectionLookupThatBreaksOnOneRow(bad_connection_id)
    pool = MagicMock()
    pool.acquire.return_value.__aenter__.return_value = con
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: pool


# -- Non-vacuity FIRST — the happy path this boundary must leave alone --------


def test_three_healthy_rows_all_enrich(monkeypatch, client):
    """⛔ CONTROL. Every degradation case below rests on this fixture actually enriching."""
    rows = [_watch_row(*r) for r in THREE_ROWS]
    _wire(monkeypatch, rows=rows, bad_connection_id=None)

    res = client.get("/sources/watches", headers=_headers())

    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data) == 3
    assert [w["source_folder_name"] for w in data] == [
        "Finance Reports",
        "Site Photos",
        "Contracts",
    ]
    assert all(w["item_count"] == 2 for w in data)
    assert all(w["connection_name"] == "Team Drive" for w in data)


def test_a_healthy_row_is_never_flagged_degraded(monkeypatch, client):
    """The flag is set on purpose, not by accident."""
    rows = [_watch_row(*r) for r in THREE_ROWS]
    _wire(monkeypatch, rows=rows, bad_connection_id=None)

    data = client.get("/sources/watches", headers=_headers()).json()

    assert all(w["degraded"] is False for w in data)
    assert all(w["degraded_reason"] is None for w in data)


# -- V-14 / D-235-13 — one broken row costs one row -------------------------


def test_one_broken_row_does_not_500_the_list(monkeypatch, client):
    rows = [_watch_row(*r) for r in THREE_ROWS]
    _wire(monkeypatch, rows=rows, bad_connection_id=BAD_CONN)

    res = client.get("/sources/watches", headers=_headers())

    assert res.status_code == 200, res.text


def test_the_broken_row_is_returned_not_dropped(monkeypatch, client):
    """⛔ A source that vanishes from its own list is the silence LIB-10 forbids."""
    rows = [_watch_row(*r) for r in THREE_ROWS]
    _wire(monkeypatch, rows=rows, bad_connection_id=BAD_CONN)

    data = client.get("/sources/watches", headers=_headers()).json()

    assert len(data) == len(rows) == 3
    assert {w["id"] for w in data} == {WATCH_A, WATCH_B, WATCH_C}


def test_the_broken_row_is_named_and_flagged(monkeypatch, client):
    rows = [_watch_row(*r) for r in THREE_ROWS]
    _wire(monkeypatch, rows=rows, bad_connection_id=BAD_CONN)

    data = client.get("/sources/watches", headers=_headers()).json()
    broken = next(w for w in data if w["id"] == WATCH_B)

    assert broken["degraded"] is True
    assert broken["degraded_reason"]
    # It can be NAMED — that is what makes it a row rather than an omission.
    assert broken["source_folder_name"] == "Site Photos"
    assert broken["user_id"] == USER_ID
    assert broken["connection_id"] == BAD_CONN


def test_the_other_two_rows_are_unaffected(monkeypatch, client):
    rows = [_watch_row(*r) for r in THREE_ROWS]
    _wire(monkeypatch, rows=rows, bad_connection_id=BAD_CONN)

    data = client.get("/sources/watches", headers=_headers()).json()
    healthy = [w for w in data if w["id"] != WATCH_B]

    assert len(healthy) == 2
    assert all(w["degraded"] is False for w in healthy)
    assert all(w["degraded_reason"] is None for w in healthy)
    assert all(w["item_count"] == 2 for w in healthy)
    assert all(w["connection_name"] == "Team Drive" for w in healthy)


# -- T-235-23 — the reason reaches a screen, so it carries no stack frame ----


def test_degraded_reason_is_machine_safe(monkeypatch, client):
    rows = [_watch_row(*r) for r in THREE_ROWS]
    _wire(monkeypatch, rows=rows, bad_connection_id=BAD_CONN)

    data = client.get("/sources/watches", headers=_headers()).json()
    reason = next(w for w in data if w["id"] == WATCH_B)["degraded_reason"]

    for leak in ("Traceback", "<class '", "object at 0x", "connector_connections"):
        assert leak not in reason, f"degraded_reason leaked {leak!r}"
    assert "malformed config" not in reason, "the exception TEXT reached the wire"
    assert reason.startswith("projection_failed")
    assert "RuntimeError" in reason
    assert len(reason) < 80


def test_a_last_row_failure_still_returns_the_earlier_rows(monkeypatch, client):
    """Order-independence: the boundary is per-row, not 'everything before the first failure'."""
    rows = [_watch_row(*r) for r in THREE_ROWS]
    _wire(monkeypatch, rows=rows, bad_connection_id=GOOD_CONN_C)

    data = client.get("/sources/watches", headers=_headers()).json()

    assert len(data) == 3
    assert next(w for w in data if w["id"] == WATCH_C)["degraded"] is True
    assert next(w for w in data if w["id"] == WATCH_A)["degraded"] is False
