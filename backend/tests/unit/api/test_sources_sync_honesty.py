"""Phase 235 Plan 07 · Task 1 — the Sync button stops reporting success for work that cannot happen.

`BUG-260906-02`: `POST /sources/watches/{id}/sync` replied `status="sched" + "uled"` — describing the
REQUEST, not the outcome — and said exactly the same thing with the reader loop switched off. The
operator clicked Sync, waited, and nothing happened; `last_run_at` was `None` and the watch had
never run once.

Three properties are pinned here (D-235-14):

1. **Reader OFF => refusal, and the subject of the sentence is CONFIGURATION** — not the folder and
   not the connection. Nothing is written: poking `next_run_at` when nothing consumes it is
   precisely the false promise being removed.
2. **Reader ON => the reply carries the ask and the window** — `status="asked"`, the moment it was
   asked, and `next_check_within_seconds` so the surface can say *"next check within N"*
   (D-235-16) rather than a bare spinner.
3. ⛔ **The route is still a scheduler poke** (D-235-15). An inline listing in a request handler
   would hold a uvicorn worker for the length of a Drive listing and re-open the concurrency
   problem `claim_due_watches` was built to solve. Asserted over the live source, not assumed.

Plus the SOURCE FENCE over the forbidden word, with its non-vacuity control FIRST: a fence whose
`read_text()` silently returned "" would pass every `not in` assertion it makes.
"""
from __future__ import annotations

import inspect
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import sources
from app.config import settings
from app.main import app as real_app

USER_ID = "00000000-0000-0000-0000-000000000001"
ORG_ID = "11111111-1111-1111-1111-111111111111"
CONN_ID = "22222222-2222-2222-2222-222222222222"
WATCH_ID = "33333333-3333-3333-3333-333333333333"

#: The word this bug is about, assembled rather than typed so that THIS FILE can never be the
#: thing that makes a `grep -c` over the repository non-zero for the wrong reason.
FORBIDDEN_WORD = "sched" + "uled"

#: Words a refusal must not use. The first two would blame the wrong thing (the cause is this
#: instance's configuration, not the operator's folder or their connection); the last three are
#: severity vocabulary these surfaces deliberately do not speak.
FORBIDDEN_IN_REFUSAL = ("folder", "connection", "!", "error", "failed")


@pytest.fixture
def probe():
    app = FastAPI()
    app.include_router(sources.router)
    app.include_router(sources.router, prefix="/api")
    app.dependency_overrides = real_app.dependency_overrides
    return app


@pytest.fixture
def client(probe):
    return TestClient(probe)


def _headers():
    return {"Authorization": "Bearer test-token", "X-Org-Id": ORG_ID}


def _watch_row() -> dict:
    return {
        "id": UUID(WATCH_ID),
        "org_id": UUID(ORG_ID),
        "user_id": UUID(USER_ID),
        "connection_id": UUID(CONN_ID),
        "source_folder_id": "folder-123",
        "source_folder_name": "Finance Reports",
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


def _module_source() -> str:
    return Path(sources.__file__).read_text(encoding="utf-8")


def _update_calls(pool) -> list:
    return [c for c in pool.calls if "next_run_at = now()" in c[0]]


# -- Non-vacuity FIRST — everything below rests on this read actually reading --


def test_the_source_fence_reads_a_real_module():
    """⛔ CONTROL. A `read_text()` that returned "" would pass every `not in` below."""
    src = _module_source()
    assert len(src) > 2000, "the sources module source read back implausibly short"
    assert "def trigger_watch_sync(" in src, "the anchor this fence is about is missing"
    assert "def _enrich_watch_rows(" in src


# -- V-16 / C-7 — the word that described the request, not the outcome --------


def test_the_forbidden_word_is_gone_from_the_sources_module():
    """V-16 (backend half). The frontend half is Plan 10's; the composition fence covers both."""
    src = _module_source()
    assert FORBIDDEN_WORD not in src, (
        f"{Path(sources.__file__).name} still contains the word {FORBIDDEN_WORD!r} - "
        "it describes the request, not the outcome (BUG-260906-02)"
    )


# -- D-235-15 — ⛔ the route is a scheduler poke, and stays one ---------------


def test_the_route_still_only_pokes_the_scheduler():
    """An inline listing here holds a web worker for the length of a Drive listing."""
    src = inspect.getsource(sources.trigger_watch_sync)
    assert "next_run_at = now()" in src, "the scheduler poke was removed"
    for banned in ("sync_watch", "list_folder", "adapter", "await watch_service.", "httpx"):
        assert banned not in src, f"{banned!r} appeared in the route — D-235-15 is binding"


# -- BUG-260906-02 part 1 — reader OFF refuses, and blames configuration ------


def test_reader_off_refuses_and_writes_nothing(mock_asyncpg_pool, monkeypatch, probe, client):
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=_watch_row()))
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: mock_asyncpg_pool
    assert getattr(probe.state, "watch_service", None) is None

    res = client.post(f"/sources/watches/{WATCH_ID}/sync", headers=_headers())

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "refused"
    assert data["reader_running"] is False
    assert data["next_run_at"] is None
    # ⛔ Nothing was written. A poke nothing consumes is the false promise itself.
    assert _update_calls(mock_asyncpg_pool) == []


def test_the_refusal_blames_configuration_not_the_folder(
    mock_asyncpg_pool, monkeypatch, probe, client
):
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=_watch_row()))
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: mock_asyncpg_pool

    message = client.post(
        f"/sources/watches/{WATCH_ID}/sync", headers=_headers()
    ).json()["message"]

    lowered = message.lower()
    assert "configuration" in lowered or "switched off" in lowered
    for banned in FORBIDDEN_IN_REFUSAL:
        assert banned not in lowered, f"the refusal said {banned!r}"


def test_the_refusal_never_names_the_operator_environment_variable(
    mock_asyncpg_pool, monkeypatch, client
):
    """T-235-22 — a member must not learn this instance's operator configuration keys."""
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=_watch_row()))
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: mock_asyncpg_pool

    message = client.post(
        f"/sources/watches/{WATCH_ID}/sync", headers=_headers()
    ).json()["message"]

    assert "WATCH_" not in message.upper()
    assert "_enabled" not in message.lower()


# -- BUG-260906-02 part 2/3 — reader ON reports the ask and the window --------


def test_reader_on_pokes_the_scheduler_and_reports_the_ask(
    mock_asyncpg_pool, monkeypatch, probe, client
):
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=_watch_row()))
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: mock_asyncpg_pool
    probe.state.watch_service = object()

    res = client.post(f"/sources/watches/{WATCH_ID}/sync", headers=_headers())

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "asked"
    assert data["reader_running"] is True
    assert data["next_run_at"] is not None
    assert data["next_check_within_seconds"] == settings.watch_poll_interval_seconds
    assert WATCH_ID in data["message"]
    # The poke ran, exactly once, and it is the same statement it always was.
    assert len(_update_calls(mock_asyncpg_pool)) == 1


def test_the_accepted_message_speaks_no_severity(mock_asyncpg_pool, monkeypatch, probe, client):
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=_watch_row()))
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: mock_asyncpg_pool
    probe.state.watch_service = object()

    message = client.post(
        f"/sources/watches/{WATCH_ID}/sync", headers=_headers()
    ).json()["message"]

    for banned in ("!", "error", "failed", "warning"):
        assert banned not in message.lower()


# -- T-235-26 — the refusal must not become a watch-existence oracle ----------


def test_ownership_404_precedes_the_reader_check(mock_asyncpg_pool, monkeypatch, probe, client):
    """A foreign or unknown id is 404 whether the reader is on or off."""
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=None))
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: mock_asyncpg_pool
    assert getattr(probe.state, "watch_service", None) is None

    res = client.post(f"/sources/watches/{WATCH_ID}/sync", headers=_headers())

    assert res.status_code == 404
    assert res.json()["detail"] == "Watch not found or unauthorized."
    assert _update_calls(mock_asyncpg_pool) == []
