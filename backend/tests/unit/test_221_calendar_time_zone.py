"""Phase 221 — a calendar event at "Thursday at 3pm" must land at three in the afternoon.

⚠ THIS FILE EXISTS BECAUSE `create_event` SHIPPED BROKEN FOR THE COMMONEST INPUT THERE IS,
and every gate in the repository was green while it was.

Google's rule: *"a time zone offset is required unless a time zone is explicitly specified in
timeZone."* `_time_field` sent NEITHER for a naive datetime, so `2026-09-04T15:00:00` — which
is exactly what a model writes when a person says "Thursday at 3pm" — came back
`HTTP 400 (required)` every single time.

⚠ WHAT MADE IT INVISIBLE: two of the three input shapes worked. An explicit `Z` offset
succeeded and an all-day `date` succeeded; only the naive middle case failed. A test that
picked either of the working shapes — which is what a test author reaching for an ISO string
would naturally do — proved the feature worked. Driven live against the operator's own
calendar on 2026-09-01: naive FAILED, `Z` OK, all-day OK.

⚠ THE SILENT-WRONG-ANSWER ALTERNATIVE IS WORSE THAN THE 400, and is the reason the fix costs
a network call. Defaulting a naive time to UTC would have made every arm "pass" while moving
the operator's meetings by their offset — a wrong answer wearing a right answer's clothes.
The calendar's own zone is the only place the true meaning of a naive time lives.
"""
from __future__ import annotations

import pytest

from app.services.google.writes import _has_offset, _time_field

TZ = "Europe/London"  # what the operator's calendar actually reports


# ── the offset predicate ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "value",
    [
        "2026-09-04T15:00:00Z",
        "2026-09-04T15:00:00+02:00",
        "2026-09-04T15:00:00-05:00",
        "2026-09-04T15:00:00+0200",  # the compact form is legal too
    ],
)
def test_an_offset_is_recognised(value):
    assert _has_offset(value) is True


@pytest.mark.parametrize(
    "value",
    [
        "2026-09-04T15:00:00",
        "2026-09-04T15:00",
        "2026-09-04T15:00:00.123456",
    ],
)
def test_a_naive_instant_has_no_offset(value):
    assert _has_offset(value) is False


def test_a_bare_date_is_decided_before_the_offset_logic_is_ever_consulted():
    """⚠ RECORDED HONESTLY: THIS REPLACED A TEST THAT COULD NOT FAIL.

    The first cut asserted that the END-anchor on `_OFFSET` stops `2026-09-04` reading as
    "already offset". Driving it RED against an UN-anchored pattern, the suite stayed
    **16 passed** — because `_time_field` decides the all-day arm FIRST, on length, and a
    bare date never reaches `_has_offset` at all. The anchor is defensive and no realistic
    input makes it load-bearing, so asserting it was decoration.

    What IS load-bearing is the ORDER: the date arm short-circuits. If someone reorders
    these branches so the offset logic runs first, an all-day date becomes a `dateTime`
    with a bogus zone, and THAT is a shape Google rejects. This asserts the order.
    """
    assert _time_field("2026-09-04", TZ) == {"date": "2026-09-04"}
    assert "timeZone" not in _time_field("2026-09-04", TZ)
    assert _has_offset("2026-09-04") is False


# ── the field builder ────────────────────────────────────────────────────────────────────


def test_a_naive_instant_carries_the_calendars_time_zone():
    """⭐ THE ARM THAT WAS BROKEN. Without `timeZone` this payload is a 400."""
    assert _time_field("2026-09-04T15:00:00", TZ) == {
        "dateTime": "2026-09-04T15:00:00",
        "timeZone": TZ,
    }


def test_an_explicit_offset_is_left_completely_alone():
    """⚠ NO `timeZone` IS ATTACHED TO AN ALREADY-PINNED INSTANT.

    `2026-09-04T15:00:00+02:00` names a single moment. Adding a `timeZone` beside it invites
    Google to reinterpret an instant the caller had already decided, which would turn a
    correct call into a silently shifted one — the exact failure mode this fix exists to
    avoid, pointed the other way.
    """
    for value in ("2026-09-04T15:00:00Z", "2026-09-04T15:00:00+02:00"):
        assert _time_field(value, TZ) == {"dateTime": value}


def test_an_all_day_date_is_a_date_and_never_gets_a_time_zone():
    """Google's two shapes are `{"date": ...}` and `{"dateTime": ...}`; a `timeZone` on a
    `date` is not a shape Google accepts."""
    assert _time_field("2026-09-04", TZ) == {"date": "2026-09-04"}


def test_no_time_zone_available_degrades_to_the_old_payload_rather_than_guessing():
    """⚠ When the calendar's zone cannot be read we send what the caller gave us and let
    Google refuse. Substituting UTC here would move the meeting instead of reporting a
    problem — a wrong answer that looks like a right one."""
    assert _time_field("2026-09-04T15:00:00", "") == {"dateTime": "2026-09-04T15:00:00"}


def test_whitespace_is_stripped_before_any_of_this_is_decided():
    assert _time_field("  2026-09-04  ", TZ) == {"date": "2026-09-04"}


# ── the shape of the fix ─────────────────────────────────────────────────────────────────


async def test_the_time_zone_lookup_never_raises_into_the_caller(monkeypatch):
    """A diagnostic read that fails must not take the write down with it.

    ⚠ The lookup exists to IMPROVE a payload. If it cannot answer, `create_event` should
    still attempt the call and let Google speak — never fail with a message about a
    time-zone read the caller never asked for.
    """
    from app.services.google import writes

    async def _boom(*a, **k):
        raise RuntimeError("calendar unreachable")

    monkeypatch.setattr(writes, "write_json", _boom)
    assert await writes._calendar_time_zone("conn", "primary") == ""


async def test_the_lookup_travels_under_the_calendar_write_key(monkeypatch):
    """⚠ Its OWN key, never the read one. The egress key selects an allow-list, and a write
    tool borrowing `calendar_read` would reach a surface its own key does not name."""
    from app.services.google import writes

    seen = {}

    async def _capture(capability, connection_id, method, url, payload, **kw):
        seen.update(capability=capability, method=method, url=url)
        return {"timeZone": TZ}

    monkeypatch.setattr(writes, "write_json", _capture)
    assert await writes._calendar_time_zone("conn", "primary") == TZ
    assert seen["capability"] == writes.CALENDAR == "calendar_write"
    assert seen["method"] == "GET"
    assert seen["url"].endswith("/primary")


async def test_a_non_string_time_zone_is_treated_as_absent(monkeypatch):
    """A vendor field that is not a string is not a time zone."""
    from app.services.google import writes

    async def _weird(*a, **k):
        return {"timeZone": 42}

    monkeypatch.setattr(writes, "write_json", _weird)
    assert await writes._calendar_time_zone("conn", "primary") == ""
