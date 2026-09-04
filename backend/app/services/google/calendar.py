"""Read Google Calendar — which calendars, what is on them, and when someone is free.

⛔ READS ONLY — `calendar.readonly`. No create, no update, no delete, no RSVP.

⚠ `find_free_time` IS A POST AND IS STILL A READ. Google models `freeBusy.query` as a
POST because the request body carries a list of calendars, not because it changes
anything. Two things keep that honest and neither is a comment: the scope is
`calendar.readonly`, so this token cannot mutate a calendar whatever it sends; and
`_http.post_json`'s docstring names this as its ONLY caller.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from app.services.google._http import GoogleReadError, get_json, post_json

CAPABILITY = "calendar_read"
API = "https://www.googleapis.com/calendar/v3"

__all__ = ["list_calendars", "list_events", "get_event", "find_free_time", "CAPABILITY"]


def _when(node: Any) -> str:
    """`dateTime` for a timed event, `date` for an all-day one. Google sends one or the
    other and never both, so reading only `dateTime` silently loses every all-day event."""
    if not isinstance(node, dict):
        return ""
    return str(node.get("dateTime") or node.get("date") or "")


def _slim(event: dict) -> dict[str, Any]:
    return {
        "id": event.get("id"),
        "summary": event.get("summary") or "(no title)",
        "start": _when(event.get("start")),
        "end": _when(event.get("end")),
        "all_day": bool((event.get("start") or {}).get("date")),
        "location": event.get("location") or "",
        "organizer": ((event.get("organizer") or {}).get("email") or ""),
        "attendees": [
            {"email": a.get("email"), "response": a.get("responseStatus")}
            for a in (event.get("attendees") or [])
            if isinstance(a, dict)
        ],
        "status": event.get("status"),
        "html_link": event.get("htmlLink") or "",
    }


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _window(days_ahead: int, days_back: int = 0) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    return _iso(now - timedelta(days=days_back)), _iso(now + timedelta(days=days_ahead))


async def list_calendars(connection_id: str | UUID) -> dict[str, Any]:
    """Every calendar this account can see, with its id.

    ⚠ THE REACHABILITY HALF, as `list_sheet_tabs` is for `read_sheet`. Every other tool
    here takes a `calendar_id`, and a model that has never seen the list can only guess
    `primary` — which is right for the person's own diary and wrong for every shared or
    team calendar they actually wanted.
    """
    data = await get_json(
        CAPABILITY, connection_id, f"{API}/users/me/calendarList",
        {"maxResults": "100", "minAccessRole": "reader"}, what="list_calendars",
    )
    return {
        "calendars": [
            {
                "id": c.get("id"),
                "summary": c.get("summary"),
                "primary": bool(c.get("primary")),
                "access_role": c.get("accessRole"),
                "time_zone": c.get("timeZone"),
            }
            for c in (data.get("items") or [])
            if isinstance(c, dict)
        ]
    }


async def list_events(
    connection_id: str | UUID,
    calendar_id: str | None = None,
    days_ahead: int = 7,
    days_back: int = 0,
    query: str | None = None,
    limit: int = 25,
) -> dict[str, Any]:
    """Events in a window, expanded and in start order.

    ⚠ `singleEvents=true` IS LOAD-BEARING. Without it a recurring meeting comes back ONCE,
    as its defining rule, with the series' original start date — so "what is on my calendar
    this week" answers with a date from three years ago and omits every actual occurrence.
    `orderBy=startTime` is only legal alongside it, which is Google's way of saying the
    same thing.
    """
    cal = str(calendar_id or "primary").strip() or "primary"
    time_min, time_max = _window(max(0, int(days_ahead or 0)), max(0, int(days_back or 0)))
    params = {
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": str(max(1, min(int(limit or 25), 100))),
    }
    if query:
        params["q"] = str(query)
    data = await get_json(
        CAPABILITY, connection_id, f"{API}/calendars/{cal}/events", params,
        what="list_events",
    )
    events = [_slim(e) for e in (data.get("items") or []) if isinstance(e, dict)]
    return {
        "calendar_id": cal,
        "from": time_min,
        "to": time_max,
        "events": events,
        "note": None if events else (
            "The search succeeded and that window is empty — this is not a permission "
            "problem, which would have raised an error instead."
        ),
    }


async def get_event(
    connection_id: str | UUID, event_id: str, calendar_id: str | None = None
) -> dict[str, Any]:
    """One event in full, including attendees and their responses."""
    eid = str(event_id or "").strip()
    if not eid:
        raise GoogleReadError("get_event needs an event id and none was supplied")
    cal = str(calendar_id or "primary").strip() or "primary"
    data = await get_json(
        CAPABILITY, connection_id, f"{API}/calendars/{cal}/events/{eid}", None,
        what="get_event",
    )
    out = _slim(data)
    out["description"] = (data.get("description") or "")[:20_000]
    out["conference"] = ((data.get("conferenceData") or {}).get("conferenceId") or "")
    out["calendar_id"] = cal
    return out


async def find_free_time(
    connection_id: str | UUID,
    days_ahead: int = 7,
    calendar_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Busy blocks across one or more calendars — the raw material for "when am I free".

    Returns BUSY intervals, which is what Google returns and what is actually knowable.
    ⚠ IT DOES NOT INVERT THEM INTO FREE SLOTS, and that is deliberate: inverting needs a
    working-hours definition and a timezone this service has not been told, so a "free"
    answer computed here would be a guess wearing the costume of a fact.
    """
    time_min, time_max = _window(max(1, int(days_ahead or 7)))
    ids = [str(c) for c in (calendar_ids or ["primary"]) if str(c).strip()][:20]
    data = await post_json(
        CAPABILITY,
        connection_id,
        f"{API}/freeBusy",
        {"timeMin": time_min, "timeMax": time_max, "items": [{"id": i} for i in ids]},
        what="find_free_time",
    )
    out: dict[str, Any] = {"from": time_min, "to": time_max, "busy": {}, "errors": {}}
    for cal_id, entry in (data.get("calendars") or {}).items():
        entry = entry or {}
        out["busy"][cal_id] = [
            {"start": b.get("start"), "end": b.get("end")}
            for b in (entry.get("busy") or [])
            if isinstance(b, dict)
        ]
        # ⚠ PER-CALENDAR ERRORS ARE REPORTED, NOT DROPPED. freeBusy answers 200 with a
        # per-calendar `errors` array for one it could not read, so a calendar the account
        # cannot see would otherwise appear as "completely free" — the most dangerous
        # possible wrong answer for a scheduling question.
        if entry.get("errors"):
            out["errors"][cal_id] = [
                str((e or {}).get("reason") or "") for e in entry["errors"]
            ]
    if out["errors"]:
        out["note"] = (
            "Some calendars could not be read and are listed under `errors`. They are NOT "
            "free — their availability is unknown."
        )
    return out
