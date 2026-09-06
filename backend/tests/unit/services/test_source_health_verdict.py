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
from uuid import uuid4

import pytest

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
