"""Phase 235 plan 06 (LIB-10 / SURF-03 · D-235-05 / D-235-10 / D-235-12 / D-235-21).

The stopped verdict, and the honest reader probe.

⭐ **NON-VACUITY FIRST.** Every property below rests on `SOFT_FAILURE_THRESHOLD` and
`HARD_CAUSES` being what plan 02 shipped. If either drifted — a threshold of 1, an empty
hard set — most of these assertions would still pass while meaning nothing. So the first
two tests pin the constants, and only then does anything rest on them.

⛔ **V-05's hardest case is `test_two_soft_failures_is_not_stopped`, and it is named
literally.** SC#4's *"does not fire for a single transient failure the next check recovered
from"* is the criterion most easily satisfied by accident (any implementation that never
fires satisfies it) and most easily lost (an off-by-one in the streak comparison). Failure
2 of a soft cause sits exactly on the boundary.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import sources
from app.main import app as real_app
from app.services.sources.failure_cause import HARD_CAUSES, SOFT_FAILURE_THRESHOLD
from app.services.sources.health_verdict import Verdict, verdict_for_runs

BASE = datetime(2026, 9, 6, 12, 0, 0, tzinfo=timezone.utc)

USER_ID = "00000000-0000-0000-0000-000000000001"
ORG_ID = "11111111-1111-1111-1111-111111111111"
WATCH_ID = "33333333-3333-3333-3333-333333333333"


def _run(status: str, *, minutes_ago: int, cause: str | None = None) -> dict:
    """One stored tick, in the shape `recent_runs_by_watch` returns."""
    return {
        "id": uuid4(),
        "watch_id": WATCH_ID,
        "org_id": ORG_ID,
        "user_id": USER_ID,
        "started_at": BASE - timedelta(minutes=minutes_ago),
        "finished_at": BASE - timedelta(minutes=minutes_ago) + timedelta(seconds=5),
        "status": status,
        "failure_cause": cause,
        "last_error": None if status == "success" else "boom",
        "listing_complete": True,
        "count_new": 0,
        "count_modified": 0,
        "count_renamed": 0,
        "count_missing": 0,
        "count_restored": 0,
        "count_errors": 0,
    }


# ── Non-vacuity — the constants every property below rests on ─────────────────


def test_soft_threshold_is_three():
    """⭐ Pin the constant BEFORE anything rests on it (plan 02, D-235-10)."""
    assert SOFT_FAILURE_THRESHOLD == 3


def test_hard_causes_is_non_empty_and_soft_causes_exist():
    """A hard set that is empty, or that swallows every cause, makes the split vacuous."""
    assert HARD_CAUSES, "HARD_CAUSES is empty — hard-on-1 could never fire"
    assert "token_revoked" in HARD_CAUSES
    assert "folder_gone" in HARD_CAUSES
    assert "unreachable" not in HARD_CAUSES, "unreachable must stay SOFT"
    assert "unknown" not in HARD_CAUSES, "unknown must stay SOFT — we do not guess hard"


# ── Zero rows is a different sentence from zero failures ──────────────────────


def test_never_read_when_there_are_no_runs():
    """⛔ D-235-10 / RESEARCH §13.2 caveat — a watch created and never ticked is not broken."""
    v = verdict_for_runs([])
    assert isinstance(v, Verdict)
    assert v.never_read is True
    assert v.stopped is False
    assert v.cause is None
    assert v.hard is False
    assert v.stopped_since is None
    assert v.last_good_at is None


def test_never_read_is_false_once_any_row_exists():
    v = verdict_for_runs([_run("success", minutes_ago=1)])
    assert v.never_read is False
    assert v.stopped is False


# ── Hard causes stop on failure ONE ───────────────────────────────────────────


def test_token_revoked_stops_on_first_failure():
    v = verdict_for_runs([_run("failed", minutes_ago=1, cause="token_revoked")])
    assert v.stopped is True
    assert v.hard is True
    assert v.cause == "token_revoked"
    assert v.never_read is False


def test_folder_gone_stops_on_first_failure():
    v = verdict_for_runs([_run("failed", minutes_ago=1, cause="folder_gone")])
    assert v.stopped is True
    assert v.hard is True
    assert v.cause == "folder_gone"


# ── Soft causes need THREE — and two is the boundary ──────────────────────────


def test_one_soft_failure_is_not_stopped():
    v = verdict_for_runs([_run("failed", minutes_ago=1, cause="unreachable")])
    assert v.stopped is False
    assert v.hard is False
    assert v.cause == "unreachable"


def test_two_soft_failures_is_not_stopped():
    """⭐ V-05 / SC#4 — THE case. Failure 2 of a recoverable cause is NOT a stopped source.

    Named literally so a future edit that breaks it cannot be mistaken for a rename.
    """
    runs = [
        _run("failed", minutes_ago=1, cause="unreachable"),
        _run("failed", minutes_ago=61, cause="unreachable"),
    ]
    v = verdict_for_runs(runs)
    assert v.stopped is False
    assert v.hard is False
    assert v.cause == "unreachable"


def test_three_soft_failures_is_stopped():
    runs = [
        _run("failed", minutes_ago=1, cause="unreachable"),
        _run("failed", minutes_ago=61, cause="unreachable"),
        _run("failed", minutes_ago=121, cause="unreachable"),
    ]
    v = verdict_for_runs(runs)
    assert v.stopped is True
    assert v.hard is False
    assert v.cause == "unreachable"


def test_unknown_cause_is_soft_and_needs_three():
    """A cause we could not name is not a licence to escalate early."""
    two = [_run("failed", minutes_ago=1), _run("failed", minutes_ago=61)]
    assert verdict_for_runs(two).stopped is False
    three = two + [_run("failed", minutes_ago=121)]
    v = verdict_for_runs(three)
    assert v.stopped is True
    assert v.cause == "unknown"


# ── Only LEADING non-successes count ──────────────────────────────────────────


def test_a_recovered_blip_resets_the_streak():
    """`[failed, success, failed]` newest-first — the newest run failed once, not twice."""
    runs = [
        _run("failed", minutes_ago=1, cause="unreachable"),
        _run("success", minutes_ago=61),
        _run("failed", minutes_ago=121, cause="unreachable"),
    ]
    v = verdict_for_runs(runs)
    assert v.stopped is False
    assert v.last_good_at == BASE - timedelta(minutes=61)


def test_three_failures_below_a_success_do_not_stop_a_recovered_source():
    runs = [
        _run("success", minutes_ago=1),
        _run("failed", minutes_ago=61, cause="unreachable"),
        _run("failed", minutes_ago=121, cause="unreachable"),
        _run("failed", minutes_ago=181, cause="unreachable"),
    ]
    v = verdict_for_runs(runs)
    assert v.stopped is False
    assert v.cause is None
    assert v.last_good_at == BASE - timedelta(minutes=1)


# ── The timestamps ────────────────────────────────────────────────────────────


def test_stopped_since_is_the_oldest_row_in_the_streak():
    """⚠ Not the newest — a source dead a week must not read as stopped a minute ago."""
    runs = [
        _run("failed", minutes_ago=1, cause="unreachable"),
        _run("failed", minutes_ago=61, cause="unreachable"),
        _run("failed", minutes_ago=121, cause="unreachable"),
        _run("success", minutes_ago=181),
    ]
    v = verdict_for_runs(runs)
    assert v.stopped is True
    assert v.stopped_since == BASE - timedelta(minutes=121)
    assert v.last_good_at == BASE - timedelta(minutes=181)


def test_last_good_at_is_none_when_nothing_ever_succeeded():
    runs = [
        _run("failed", minutes_ago=1, cause="token_revoked"),
        _run("failed", minutes_ago=61, cause="token_revoked"),
    ]
    v = verdict_for_runs(runs)
    assert v.last_good_at is None
    assert v.stopped is True


# ── `paused` — the tick happened and did not read ─────────────────────────────


def test_paused_counts_toward_the_streak_but_classifies_as_unknown():
    runs = [
        _run("paused", minutes_ago=1),
        _run("paused", minutes_ago=61),
        _run("paused", minutes_ago=121),
    ]
    v = verdict_for_runs(runs)
    assert v.stopped is True
    assert v.cause == "unknown"
    assert v.hard is False


def test_paused_carrying_a_cause_keeps_that_cause():
    runs = [_run("paused", minutes_ago=1, cause="token_revoked")]
    v = verdict_for_runs(runs)
    assert v.cause == "token_revoked"
    assert v.stopped is True


# ── Purity — the verdict reaches no database ──────────────────────────────────


def test_verdict_module_imports_nothing_from_the_db_or_api_layers():
    """The verdict must stay usable from a producer that has not opened a pool."""
    import inspect

    from app.services.sources import health_verdict

    src = inspect.getsource(health_verdict)
    for forbidden in ("app.db", "app.api", "asyncpg", "supabase", "app.dependencies"):
        assert forbidden not in src, f"health_verdict must not reach {forbidden}"


def test_verdict_is_frozen():
    v = verdict_for_runs([])
    with pytest.raises(Exception):
        v.stopped = True  # type: ignore[misc]


# ══ The routes — GET /sources/health and GET /sources/watches/{id}/runs ═══════
#
# ⚠ These live HERE rather than in Phase 234's `test_sources_watches_api.py` on purpose: that
#   file's ten shipped cases are left byte-unchanged, so "still 10, still green" stays a clean
#   before/after statement about this plan rather than a count that moved for two reasons.

CONN_ID = "22222222-2222-2222-2222-222222222222"


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


def _watch_row(watch_id: str = WATCH_ID, name: str = "Finance Reports") -> dict:
    return {
        "id": UUID(watch_id),
        "org_id": UUID(ORG_ID),
        "user_id": UUID(USER_ID),
        "connection_id": UUID(CONN_ID),
        "source_folder_id": "folder-123",
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


def _pool_with_connection_names(names: dict[str, str] | None = None):
    """A pool whose only statement is the stopped-sources connection-name lookup."""
    con = AsyncMock()
    con.fetch.return_value = [
        {"id": UUID(cid), "name": nm} for cid, nm in (names or {}).items()
    ]
    pool = MagicMock()
    pool.acquire.return_value.__aenter__.return_value = con
    return pool


def _wire_health(monkeypatch, *, watches: list[dict], runs: dict, pool) -> None:
    monkeypatch.setattr("app.api.sources.list_watches", AsyncMock(return_value=watches))
    monkeypatch.setattr(
        "app.api.sources.recent_runs_by_watch", AsyncMock(return_value=runs)
    )
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: pool


# ── V-19 / D-235-21 — the reader probe is the LIVE process, not the flag ──────


def test_reader_running_is_false_when_the_service_is_absent(monkeypatch, probe, client):
    """⛔ V-19 — THE case C-4 exists for.

    `settings.watch_process_enabled` is forced True (it is `true` in the operator's real
    `backend/.env`), and no watch service is published on `app.state` — exactly the state
    `main.py:587-589` produces when the loop fails to start. The endpoint must say the reader
    is NOT running. Reading the flag would make this test pass a lie.
    """
    monkeypatch.setattr(sources.settings, "watch_process_enabled", True, raising=False)
    assert sources.settings.watch_process_enabled is True
    assert getattr(probe.state, "watch_service", None) is None

    _wire_health(monkeypatch, watches=[], runs={}, pool=_pool_with_connection_names())

    res = client.get("/sources/health", headers=_headers())
    assert res.status_code == 200, res.text
    assert res.json()["reader_running"] is False


def test_reader_running_is_true_when_the_service_is_live(monkeypatch, probe, client):
    """And the probe is not merely hard-wired to False — the positive arm is asserted too."""
    monkeypatch.setattr(sources.settings, "watch_process_enabled", False, raising=False)
    probe.state.watch_service = object()

    _wire_health(monkeypatch, watches=[], runs={}, pool=_pool_with_connection_names())

    res = client.get("/sources/health", headers=_headers())
    assert res.status_code == 200, res.text
    assert res.json()["reader_running"] is True


def test_health_route_never_mentions_the_config_flag():
    """A grep-shaped guard over the live source (the acceptance criterion, as a test)."""
    import inspect

    src = inspect.getsource(sources.get_source_health)
    assert "settings.watch_process_enabled" not in src
    assert "app.state.watch_service" in src or "watch_service" in src


# ── D-235-12 — reader off is an INSTANCE fact, not N broken sources ───────────


def test_reader_off_reports_zero_stopped_sources(monkeypatch, probe, client):
    """⛔ D-235-12 — marking every watch stopped would make the badge count N broken sources
    when nothing is wrong with any of them."""
    watches = [_watch_row(), _watch_row(str(uuid4()), name="Legal")]
    _wire_health(
        monkeypatch, watches=watches, runs={}, pool=_pool_with_connection_names()
    )

    res = client.get("/sources/health", headers=_headers())
    body = res.json()
    assert body["reader_running"] is False
    assert body["stopped"] == []


# ── V-13 (backend half) / SC#4 — the signal does not fire for healthy or 1 blip ─


def test_health_omits_a_healthy_source(monkeypatch, client):
    _wire_health(
        monkeypatch,
        watches=[_watch_row()],
        runs={WATCH_ID: [_run("success", minutes_ago=1)]},
        pool=_pool_with_connection_names(),
    )
    res = client.get("/sources/health", headers=_headers())
    assert res.json()["stopped"] == []


def test_health_omits_a_source_with_one_soft_failure(monkeypatch, client):
    """SC#4 — a single transient failure the next check can recover from is not a signal."""
    _wire_health(
        monkeypatch,
        watches=[_watch_row()],
        runs={WATCH_ID: [_run("failed", minutes_ago=1, cause="unreachable")]},
        pool=_pool_with_connection_names(),
    )
    res = client.get("/sources/health", headers=_headers())
    assert res.json()["stopped"] == []


def test_health_omits_a_watch_that_has_never_run(monkeypatch, client):
    """V-06 at the route: zero rows is `has not read yet`, never `stopped`."""
    _wire_health(
        monkeypatch,
        watches=[_watch_row()],
        runs={},
        pool=_pool_with_connection_names(),
    )
    res = client.get("/sources/health", headers=_headers())
    assert res.json()["stopped"] == []


def test_health_lists_a_hard_stopped_source_with_its_connection_name(monkeypatch, client):
    _wire_health(
        monkeypatch,
        watches=[_watch_row()],
        runs={WATCH_ID: [_run("failed", minutes_ago=1, cause="token_revoked")]},
        pool=_pool_with_connection_names({CONN_ID: "Team Drive"}),
    )
    res = client.get("/sources/health", headers=_headers())
    body = res.json()
    assert len(body["stopped"]) == 1
    row = body["stopped"][0]
    assert row["watch_id"] == WATCH_ID
    assert row["cause"] == "token_revoked"
    assert row["hard"] is True
    assert row["source_folder_name"] == "Finance Reports"
    assert row["connection_name"] == "Team Drive"
    assert row["stopped_since"] is not None


def test_health_declares_the_server_side_poll_interval(monkeypatch, client):
    monkeypatch.setattr(sources.settings, "watch_poll_interval_seconds", 90, raising=False)
    _wire_health(
        monkeypatch, watches=[], runs={}, pool=_pool_with_connection_names()
    )
    res = client.get("/sources/health", headers=_headers())
    assert res.json()["poll_interval_seconds"] == 90


# ── T-235-21 — one bad row must not 500 the endpoint the shell polls ──────────


def test_health_skips_an_unprojectable_watch_instead_of_500ing(monkeypatch, client):
    """SEED-239's shape at a second list. The healthy neighbour still gets its verdict."""
    bad = _watch_row(str(uuid4()))
    bad["source_folder_name"] = object()  # not serialisable into the response model
    good_id = str(uuid4())
    good = _watch_row(good_id, name="Legal")

    _wire_health(
        monkeypatch,
        watches=[bad, good],
        runs={
            str(bad["id"]): [_run("failed", minutes_ago=1, cause="folder_gone")],
            good_id: [_run("failed", minutes_ago=1, cause="token_revoked")],
        },
        pool=_pool_with_connection_names({CONN_ID: "Team Drive"}),
    )

    res = client.get("/sources/health", headers=_headers())
    assert res.status_code == 200, res.text
    stopped = res.json()["stopped"]
    assert [s["watch_id"] for s in stopped] == [good_id]


# ── T-235-18 — the history route is owner-predicated at the route too ─────────


def test_runs_route_returns_history_for_the_owner(monkeypatch, client):
    monkeypatch.setattr(
        "app.api.sources.get_watch", AsyncMock(return_value=_watch_row())
    )
    run = _run("success", minutes_ago=1)
    run["count_new"] = 4
    monkeypatch.setattr(
        "app.api.sources.list_sync_runs", AsyncMock(return_value=[run])
    )
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: MagicMock()

    res = client.get(f"/sources/watches/{WATCH_ID}/runs", headers=_headers())
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body) == 1
    assert body[0]["count_new"] == 4
    assert body[0]["listing_complete"] is True


def test_runs_route_returns_404_for_another_tenants_watch(monkeypatch, client):
    """Absence over refusal — a 403 would confirm the id exists."""
    monkeypatch.setattr("app.api.sources.get_watch", AsyncMock(return_value=None))
    listed = AsyncMock(return_value=[])
    monkeypatch.setattr("app.api.sources.list_sync_runs", listed)
    real_app.dependency_overrides[deps.get_pg_pool] = lambda: MagicMock()

    res = client.get(f"/sources/watches/{uuid4()}/runs", headers=_headers())
    assert res.status_code == 404
    listed.assert_not_awaited()
